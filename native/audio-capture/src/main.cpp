// audio-capture: captura o audio de todos os programas do Windows, exceto os
// excluidos (Discord e o proprio Much), e escreve PCM s16le estereo
// 48 kHz no stdout. Eventos em JSON (uma linha por evento) saem no stderr.
//
// Uso:
//   audio-capture.exe [--exclude-pid PID]... [--exclude-name PREFIXO]...
//                     [--include-name PREFIXO]... [--watch-stdin] [--force] [--list]
//
// Com --include-name, captura apenas esses programas (ex: spotify.exe para o
// modo DJ do Much).
//
// Requer Windows 10 2004 (build 19041) ou mais novo: usa a API Process Loopback
// (AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK).

#include <windows.h>
#include <mmreg.h>
#include <timeapi.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <audiopolicy.h>
#include <mmdeviceapi.h>
#include <tlhelp32.h>
#include <wrl/client.h>
#include <wrl/implements.h>

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <cwctype>
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::FtmBase;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

namespace {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kChannels = 2;
constexpr size_t kMaxBufferedFrames = kSampleRate * 3 / 10;  // 300 ms
constexpr size_t kPrimeFrames = kSampleRate / 50;            // 20 ms
constexpr uint64_t kChunkFrames = kSampleRate / 100;         // 10 ms
constexpr uint64_t kMaxBacklogFrames = kSampleRate / 10;     // 100 ms
constexpr ULONGLONG kScanIntervalMs = 2000;
constexpr DWORD kMinBuild = 19041;

std::atomic<bool> g_stop{false};
std::mutex g_logMutex;

// ---------------------------------------------------------------------------
// Utilitarios

std::string Narrow(const std::wstring& text) {
  if (text.empty()) return {};
  int size = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), nullptr, 0, nullptr, nullptr);
  std::string out(static_cast<size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, 0, text.c_str(), static_cast<int>(text.size()), out.data(), size, nullptr, nullptr);
  return out;
}

std::wstring Lower(std::wstring text) {
  std::transform(text.begin(), text.end(), text.begin(), [](wchar_t c) { return static_cast<wchar_t>(std::towlower(c)); });
  return text;
}

std::string JsonEscape(const std::string& text) {
  std::string out;
  out.reserve(text.size());
  for (char c : text) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (static_cast<unsigned char>(c) < 0x20) {
          char buf[8];
          snprintf(buf, sizeof(buf), "\\u%04x", c);
          out += buf;
        } else {
          out += c;
        }
    }
  }
  return out;
}

void EmitEvent(const std::string& json) {
  std::lock_guard<std::mutex> lock(g_logMutex);
  fprintf(stderr, "%s\n", json.c_str());
  fflush(stderr);
}

void EmitError(const std::string& message) {
  EmitEvent("{\"event\":\"error\",\"message\":\"" + JsonEscape(message) + "\"}");
}

void EmitLog(const std::string& message) {
  EmitEvent("{\"event\":\"log\",\"message\":\"" + JsonEscape(message) + "\"}");
}

std::string HrToString(HRESULT hr) {
  char buf[16];
  snprintf(buf, sizeof(buf), "0x%08lX", static_cast<unsigned long>(hr));
  return buf;
}

DWORD WindowsBuild() {
  using RtlGetVersionFn = LONG(WINAPI*)(PRTL_OSVERSIONINFOW);
  HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  if (!ntdll) return 0;
  auto fn = reinterpret_cast<RtlGetVersionFn>(reinterpret_cast<void*>(GetProcAddress(ntdll, "RtlGetVersion")));
  RTL_OSVERSIONINFOW info{};
  info.dwOSVersionInfoSize = sizeof(info);
  if (fn && fn(&info) == 0) return info.dwBuildNumber;
  return 0;
}

// ---------------------------------------------------------------------------
// Processos

struct ProcessInfo {
  DWORD parent = 0;
  std::wstring exe;
};

using ProcessTable = std::unordered_map<DWORD, ProcessInfo>;

ProcessTable SnapshotProcesses() {
  ProcessTable table;
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) return table;
  PROCESSENTRY32W entry{};
  entry.dwSize = sizeof(entry);
  if (Process32FirstW(snapshot, &entry)) {
    do {
      table[entry.th32ProcessID] = ProcessInfo{entry.th32ParentProcessID, entry.szExeFile};
    } while (Process32NextW(snapshot, &entry));
  }
  CloseHandle(snapshot);
  return table;
}

// Percorre pid, pai, avo... chamando visit(pid, info). Para quando visit retorna true.
template <typename Visit>
bool WalkAncestors(DWORD pid, const ProcessTable& table, Visit visit) {
  DWORD current = pid;
  for (int depth = 0; depth < 64 && current != 0; ++depth) {
    auto it = table.find(current);
    if (it == table.end()) return false;
    if (visit(current, it->second)) return true;
    if (it->second.parent == current) return false;
    current = it->second.parent;
  }
  return false;
}

struct Options {
  std::set<DWORD> excludePids;
  std::vector<std::wstring> excludeNames{L"discord"};
  // Vazio = captura tudo que nao foi excluido. Preenchido = so esses programas.
  std::vector<std::wstring> includeNames;
  bool watchStdin = false;
  bool force = false;
  bool list = false;
};

bool MatchesPrefix(const std::wstring& exe, const std::vector<std::wstring>& prefixes) {
  std::wstring name = Lower(exe);
  for (const auto& prefix : prefixes) {
    if (name.rfind(prefix, 0) == 0) return true;
  }
  return false;
}

// Excluido se o proprio processo ou algum ancestral for Discord/Much.
bool IsExcluded(DWORD pid, const ProcessTable& table, const Options& options) {
  return WalkAncestors(pid, table, [&](DWORD current, const ProcessInfo& info) {
    return options.excludePids.count(current) > 0 || MatchesPrefix(info.exe, options.excludeNames);
  });
}

// No modo --include-name, so entra o processo (ou filho) de um programa da lista.
bool IsIncluded(DWORD pid, const ProcessTable& table, const Options& options) {
  if (options.includeNames.empty()) return true;
  return WalkAncestors(pid, table, [&](DWORD, const ProcessInfo& info) { return MatchesPrefix(info.exe, options.includeNames); });
}

bool HasAncestorIn(DWORD pid, const std::set<DWORD>& set, const ProcessTable& table) {
  auto it = table.find(pid);
  if (it == table.end() || it->second.parent == pid) return false;
  return WalkAncestors(it->second.parent, table, [&](DWORD current, const ProcessInfo&) { return set.count(current) > 0; });
}

// ---------------------------------------------------------------------------
// Sessoes de audio

std::set<DWORD> SessionProcessIds(IMMDeviceEnumerator* enumerator) {
  std::set<DWORD> pids;
  ComPtr<IMMDeviceCollection> devices;
  if (FAILED(enumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &devices))) return pids;
  UINT deviceCount = 0;
  devices->GetCount(&deviceCount);
  for (UINT d = 0; d < deviceCount; ++d) {
    ComPtr<IMMDevice> device;
    if (FAILED(devices->Item(d, &device))) continue;
    ComPtr<IAudioSessionManager2> manager;
    if (FAILED(device->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr,
                                reinterpret_cast<void**>(manager.GetAddressOf())))) {
      continue;
    }
    ComPtr<IAudioSessionEnumerator> sessions;
    if (FAILED(manager->GetSessionEnumerator(&sessions))) continue;
    int sessionCount = 0;
    sessions->GetCount(&sessionCount);
    for (int i = 0; i < sessionCount; ++i) {
      ComPtr<IAudioSessionControl> control;
      if (FAILED(sessions->GetSession(i, &control))) continue;
      ComPtr<IAudioSessionControl2> control2;
      if (FAILED(control.As(&control2))) continue;
      if (control2->IsSystemSoundsSession() == S_OK) continue;
      AudioSessionState state{};
      if (SUCCEEDED(control2->GetState(&state)) && state == AudioSessionStateExpired) continue;
      DWORD pid = 0;
      if (FAILED(control2->GetProcessId(&pid)) || pid == 0) continue;
      pids.insert(pid);
    }
  }
  return pids;
}

// ---------------------------------------------------------------------------
// Captura de um processo (Process Loopback em modo include)

class ActivationHandler
    : public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase, IActivateAudioInterfaceCompletionHandler> {
 public:
  ActivationHandler() : done_(CreateEventW(nullptr, TRUE, FALSE, nullptr)) {}
  ~ActivationHandler() {
    if (done_) CloseHandle(done_);
  }

  STDMETHOD(ActivateCompleted)(IActivateAudioInterfaceAsyncOperation* operation) override {
    HRESULT activateHr = E_FAIL;
    ComPtr<IUnknown> unknown;
    HRESULT hr = operation->GetActivateResult(&activateHr, &unknown);
    if (SUCCEEDED(hr)) hr = activateHr;
    if (SUCCEEDED(hr)) hr = unknown.As(&client_);
    result_ = hr;
    SetEvent(done_);
    return S_OK;
  }

  HRESULT Wait(DWORD timeoutMs, ComPtr<IAudioClient>& client) {
    if (WaitForSingleObject(done_, timeoutMs) != WAIT_OBJECT_0) return HRESULT_FROM_WIN32(ERROR_TIMEOUT);
    if (FAILED(result_)) return result_;
    client = client_;
    return S_OK;
  }

 private:
  HANDLE done_;
  HRESULT result_ = E_FAIL;
  ComPtr<IAudioClient> client_;
};

class ProcessCapture {
 public:
  ProcessCapture(DWORD pid, std::wstring exe) : pid_(pid), exe_(std::move(exe)) {}
  ProcessCapture(const ProcessCapture&) = delete;
  ProcessCapture& operator=(const ProcessCapture&) = delete;
  ~ProcessCapture() { Stop(); }

  HRESULT Start() {
    AUDIOCLIENT_ACTIVATION_PARAMS params{};
    params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId = pid_;
    params.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT activation{};
    activation.vt = VT_BLOB;
    activation.blob.cbSize = sizeof(params);
    activation.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

    auto handler = Make<ActivationHandler>();
    if (!handler) return E_OUTOFMEMORY;
    ComPtr<IActivateAudioInterfaceAsyncOperation> operation;
    HRESULT hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, __uuidof(IAudioClient),
                                             &activation, handler.Get(), &operation);
    if (FAILED(hr)) return hr;
    hr = handler->Wait(5000, client_);
    if (FAILED(hr)) return hr;

    WAVEFORMATEX format{};
    format.wFormatTag = WAVE_FORMAT_PCM;
    format.nChannels = static_cast<WORD>(kChannels);
    format.nSamplesPerSec = kSampleRate;
    format.wBitsPerSample = 16;
    format.nBlockAlign = static_cast<WORD>(kChannels * 2);
    format.nAvgBytesPerSec = kSampleRate * format.nBlockAlign;

    hr = client_->Initialize(AUDCLNT_SHAREMODE_SHARED,
                             AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK |
                                 AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
                             200000, 0, &format, nullptr);
    if (FAILED(hr)) return hr;

    sampleReady_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    stopEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!sampleReady_ || !stopEvent_) return HRESULT_FROM_WIN32(GetLastError());

    hr = client_->SetEventHandle(sampleReady_);
    if (FAILED(hr)) return hr;
    hr = client_->GetService(IID_PPV_ARGS(&capture_));
    if (FAILED(hr)) return hr;
    hr = client_->Start();
    if (FAILED(hr)) return hr;

    started_ = true;
    thread_ = std::thread(&ProcessCapture::Run, this);
    return S_OK;
  }

  void Stop() {
    if (stopEvent_) SetEvent(stopEvent_);
    if (thread_.joinable()) thread_.join();
    if (started_ && client_) client_->Stop();
    started_ = false;
    if (sampleReady_) CloseHandle(sampleReady_);
    if (stopEvent_) CloseHandle(stopEvent_);
    sampleReady_ = nullptr;
    stopEvent_ = nullptr;
  }

  // Soma ate `frames` quadros deste processo em `mix`.
  void MixInto(std::vector<int32_t>& mix, size_t frames) {
    std::lock_guard<std::mutex> lock(mutex_);
    size_t available = buffer_.size() / kChannels;
    if (!primed_) {
      if (available < kPrimeFrames) return;
      primed_ = true;
    }
    size_t count = std::min(available, frames);
    auto it = buffer_.begin();
    for (size_t i = 0; i < count * kChannels; ++i, ++it) mix[i] += *it;
    buffer_.erase(buffer_.begin(), buffer_.begin() + static_cast<std::ptrdiff_t>(count * kChannels));
    if (count < frames) primed_ = false;
  }

  bool failed() const { return failed_; }
  DWORD pid() const { return pid_; }
  const std::wstring& exe() const { return exe_; }

 private:
  void Run() {
    HRESULT coHr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    HANDLE handles[2] = {stopEvent_, sampleReady_};
    while (true) {
      DWORD wait = WaitForMultipleObjects(2, handles, FALSE, 1000);
      if (wait == WAIT_OBJECT_0) break;
      if (wait == WAIT_TIMEOUT) continue;
      if (wait != WAIT_OBJECT_0 + 1) {
        failed_ = true;
        break;
      }
      if (!Drain()) {
        failed_ = true;
        break;
      }
    }
    if (SUCCEEDED(coHr)) CoUninitialize();
  }

  bool Drain() {
    while (true) {
      UINT32 packetFrames = 0;
      if (FAILED(capture_->GetNextPacketSize(&packetFrames))) return false;
      if (packetFrames == 0) return true;

      BYTE* data = nullptr;
      UINT32 frames = 0;
      DWORD flags = 0;
      if (FAILED(capture_->GetBuffer(&data, &frames, &flags, nullptr, nullptr))) return false;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        const bool silent = (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0;
        const auto* samples = reinterpret_cast<const int16_t*>(data);
        for (UINT32 i = 0; i < frames * kChannels; ++i) buffer_.push_back(silent ? int16_t{0} : samples[i]);
        const size_t maxSamples = kMaxBufferedFrames * kChannels;
        if (buffer_.size() > maxSamples) {
          buffer_.erase(buffer_.begin(), buffer_.begin() + static_cast<std::ptrdiff_t>(buffer_.size() - maxSamples));
        }
      }
      capture_->ReleaseBuffer(frames);
    }
  }

  DWORD pid_;
  std::wstring exe_;
  ComPtr<IAudioClient> client_;
  ComPtr<IAudioCaptureClient> capture_;
  HANDLE sampleReady_ = nullptr;
  HANDLE stopEvent_ = nullptr;
  bool started_ = false;
  std::thread thread_;
  std::mutex mutex_;
  std::deque<int16_t> buffer_;
  bool primed_ = false;
  std::atomic<bool> failed_{false};
};

// ---------------------------------------------------------------------------
// Gerenciador: decide quais processos capturar e mistura tudo

class CaptureManager {
 public:
  CaptureManager(IMMDeviceEnumerator* enumerator, const Options& options)
      : enumerator_(enumerator), options_(options), selfPid_(GetCurrentProcessId()) {}

  void Refresh() {
    ProcessTable table = SnapshotProcesses();
    std::set<DWORD> sessionPids = SessionProcessIds(enumerator_);

    // Processos excluidos que estao rodando agora (Discord, Much e filhos).
    std::vector<DWORD> excludedRunning;
    for (const auto& [pid, info] : table) {
      if (IsExcluded(pid, table, options_)) excludedRunning.push_back(pid);
    }

    std::set<DWORD> candidates;
    for (DWORD pid : sessionPids) {
      if (pid == selfPid_ || !table.count(pid)) continue;
      if (IsExcluded(pid, table, options_) || !IsIncluded(pid, table, options_)) continue;
      // Capturar a arvore deste processo incluiria algo excluido (ex: explorer.exe
      // e pai do Discord), entao ele fica de fora.
      bool parentOfExcluded = std::any_of(excludedRunning.begin(), excludedRunning.end(), [&](DWORD excluded) {
        return HasAncestorIn(excluded, std::set<DWORD>{pid}, table);
      });
      if (parentOfExcluded) continue;
      candidates.insert(pid);
    }

    // Um pai capturado em modo arvore ja inclui os filhos.
    std::set<DWORD> wanted;
    for (DWORD pid : candidates) {
      if (!HasAncestorIn(pid, candidates, table)) wanted.insert(pid);
    }

    for (auto it = failedPids_.begin(); it != failedPids_.end();) {
      it = table.count(*it) ? std::next(it) : failedPids_.erase(it);
    }

    bool changed = false;
    for (auto it = captures_.begin(); it != captures_.end();) {
      if (it->second->failed()) failedPids_.insert(it->first);
      if (!wanted.count(it->first) || it->second->failed()) {
        it = captures_.erase(it);
        changed = true;
      } else {
        ++it;
      }
    }

    for (DWORD pid : wanted) {
      if (captures_.count(pid) || failedPids_.count(pid)) continue;
      auto capture = std::make_unique<ProcessCapture>(pid, table[pid].exe);
      HRESULT hr = capture->Start();
      if (SUCCEEDED(hr)) {
        captures_.emplace(pid, std::move(capture));
        changed = true;
      } else {
        failedPids_.insert(pid);
        EmitLog("nao foi possivel capturar " + Narrow(table[pid].exe) + " (" + HrToString(hr) + ")");
      }
    }

    if (changed || !announced_) {
      announced_ = true;
      AnnounceSources();
    }
  }

  void Mix(std::vector<int32_t>& mix, size_t frames) {
    for (auto& [pid, capture] : captures_) capture->MixInto(mix, frames);
  }

 private:
  void AnnounceSources() {
    std::string json = "{\"event\":\"sources\",\"sources\":[";
    bool first = true;
    for (const auto& [pid, capture] : captures_) {
      if (!first) json += ",";
      first = false;
      json += "{\"pid\":" + std::to_string(pid) + ",\"name\":\"" + JsonEscape(Narrow(capture->exe())) + "\"}";
    }
    json += "]}";
    EmitEvent(json);
  }

  IMMDeviceEnumerator* enumerator_;
  const Options& options_;
  DWORD selfPid_;
  std::map<DWORD, std::unique_ptr<ProcessCapture>> captures_;
  std::set<DWORD> failedPids_;
  bool announced_ = false;
};

// ---------------------------------------------------------------------------

BOOL WINAPI OnConsoleCtrl(DWORD) {
  g_stop = true;
  return TRUE;
}

void WatchStdin() {
  HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  char buffer[256];
  DWORD read = 0;
  while (ReadFile(input, buffer, sizeof(buffer), &read, nullptr) && read > 0) {
  }
  g_stop = true;
}

bool ParseOptions(int argc, wchar_t** argv, Options& options) {
  for (int i = 1; i < argc; ++i) {
    std::wstring arg = argv[i];
    if (arg == L"--exclude-pid" && i + 1 < argc) {
      options.excludePids.insert(static_cast<DWORD>(wcstoul(argv[++i], nullptr, 10)));
    } else if (arg == L"--exclude-name" && i + 1 < argc) {
      options.excludeNames.push_back(Lower(argv[++i]));
    } else if (arg == L"--include-name" && i + 1 < argc) {
      options.includeNames.push_back(Lower(argv[++i]));
    } else if (arg == L"--watch-stdin") {
      options.watchStdin = true;
    } else if (arg == L"--force") {
      options.force = true;
    } else if (arg == L"--list") {
      options.list = true;
    } else {
      EmitError("argumento desconhecido: " + Narrow(arg));
      return false;
    }
  }
  return true;
}

int ListSessions(IMMDeviceEnumerator* enumerator, const Options& options) {
  ProcessTable table = SnapshotProcesses();
  for (DWORD pid : SessionProcessIds(enumerator)) {
    auto it = table.find(pid);
    std::string exe = it == table.end() ? "?" : Narrow(it->second.exe);
    fprintf(stderr, "%6lu  %-40s %s\n", static_cast<unsigned long>(pid), exe.c_str(),
            IsExcluded(pid, table, options) || !IsIncluded(pid, table, options) ? "EXCLUIDO" : "capturado");
  }
  return 0;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  Options options;
  if (!ParseOptions(argc, argv, options)) return 1;

  DWORD build = WindowsBuild();
  if (!options.force && build < kMinBuild) {
    EmitError("O audio do sistema sem Discord precisa do Windows 10 versao 2004 (build 19041) ou mais novo. "
              "Este Windows e o build " + std::to_string(build) + ".");
    return 2;
  }

  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(hr)) {
    EmitError("CoInitializeEx falhou (" + HrToString(hr) + ")");
    return 1;
  }

  ComPtr<IMMDeviceEnumerator> enumerator;
  hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, IID_PPV_ARGS(&enumerator));
  if (FAILED(hr)) {
    EmitError("Nao foi possivel acessar os dispositivos de audio (" + HrToString(hr) + ")");
    CoUninitialize();
    return 1;
  }

  if (options.list) {
    int code = ListSessions(enumerator.Get(), options);
    enumerator.Reset();
    CoUninitialize();
    return code;
  }

  SetConsoleCtrlHandler(OnConsoleCtrl, TRUE);
  if (options.watchStdin) std::thread(WatchStdin).detach();
  timeBeginPeriod(1);

  HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  {
    CaptureManager manager(enumerator.Get(), options);
    manager.Refresh();
    EmitEvent("{\"event\":\"ready\"}");

    LARGE_INTEGER frequency{};
    LARGE_INTEGER start{};
    QueryPerformanceFrequency(&frequency);
    QueryPerformanceCounter(&start);
    uint64_t framesWritten = 0;
    ULONGLONG lastScan = GetTickCount64();
    std::vector<int32_t> mix;
    std::vector<int16_t> pcm;

    while (!g_stop) {
      ULONGLONG tick = GetTickCount64();
      if (tick - lastScan >= kScanIntervalMs) {
        lastScan = tick;
        manager.Refresh();
      }

      LARGE_INTEGER now{};
      QueryPerformanceCounter(&now);
      uint64_t elapsedFrames = static_cast<uint64_t>(now.QuadPart - start.QuadPart) * kSampleRate /
                               static_cast<uint64_t>(frequency.QuadPart);
      uint64_t due = elapsedFrames - framesWritten;
      if (due < kChunkFrames) {
        Sleep(2);
        continue;
      }
      if (due > kMaxBacklogFrames) {
        framesWritten += due - kChunkFrames;
        due = kChunkFrames;
      }

      const size_t frames = static_cast<size_t>(due);
      mix.assign(frames * kChannels, 0);
      manager.Mix(mix, frames);

      pcm.resize(mix.size());
      for (size_t i = 0; i < mix.size(); ++i) {
        pcm[i] = static_cast<int16_t>(std::clamp<int32_t>(mix[i], -32768, 32767));
      }

      const DWORD bytes = static_cast<DWORD>(pcm.size() * sizeof(int16_t));
      DWORD written = 0;
      if (!WriteFile(output, pcm.data(), bytes, &written, nullptr) || written != bytes) {
        break;
      }
      framesWritten += due;
    }
  }

  timeEndPeriod(1);
  enumerator.Reset();
  CoUninitialize();
  return 0;
}

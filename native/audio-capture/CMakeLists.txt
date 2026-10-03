cmake_minimum_required(VERSION 3.20)
project(audio_capture LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "audio-capture usa a API Process Loopback do Windows e so compila no Windows.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(audio-capture src/main.cpp)

target_compile_definitions(audio-capture PRIVATE UNICODE _UNICODE NOMINMAX _WIN32_WINNT=0x0A00)
target_compile_options(audio-capture PRIVATE /W4 /utf-8 /permissive-)
target_link_libraries(audio-capture PRIVATE ole32 mmdevapi winmm)

# Runtime estatico: o .exe roda sem instalar o Visual C++ Redistributable.
set_property(TARGET audio-capture PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

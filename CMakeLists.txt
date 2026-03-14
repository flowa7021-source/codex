cmake_minimum_required(VERSION 3.21)
project(OfflineDocStudio LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

enable_testing()

add_library(ods_core
    src/core/annotation_store.cpp
    src/core/application.cpp
    src/core/cli_options.cpp
    src/core/command_palette.cpp
    src/core/document_session.cpp
    src/core/library_manager.cpp
    src/core/logger.cpp
    src/core/navigation_history.cpp
    src/core/ocr_index.cpp
    src/core/plugins/format_registry.cpp
    src/core/portable_store.cpp
    src/core/print_plan.cpp
    src/core/reading_settings.cpp
    src/core/view_mode.cpp
)

target_include_directories(ods_core PUBLIC src)

add_executable(offline_doc_studio src/main.cpp)
target_link_libraries(offline_doc_studio PRIVATE ods_core)

add_executable(core_smoke_tests tests/core_smoke_tests.cpp)
target_link_libraries(core_smoke_tests PRIVATE ods_core)

add_test(NAME core_smoke_tests COMMAND core_smoke_tests)

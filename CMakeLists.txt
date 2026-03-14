cmake_minimum_required(VERSION 3.21)
project(OfflineDocStudio VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

enable_testing()

add_library(ods_core
    src/core/app_config.cpp
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

set(ODS_WIN_RESOURCES)
if (WIN32)
    list(APPEND ODS_WIN_RESOURCES resources/offline_doc_studio.rc)
endif()

add_executable(offline_doc_studio src/main.cpp ${ODS_WIN_RESOURCES})
target_link_libraries(offline_doc_studio PRIVATE ods_core)

add_executable(core_smoke_tests tests/core_smoke_tests.cpp)
target_link_libraries(core_smoke_tests PRIVATE ods_core)

add_test(NAME core_smoke_tests COMMAND core_smoke_tests)

include(GNUInstallDirs)
install(TARGETS offline_doc_studio RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(FILES
    README.md
    UserGuide_ru.md
    Build.md
    DESTINATION ${CMAKE_INSTALL_DATADIR}/offline_doc_studio
)
install(FILES config/hotkeys.json DESTINATION ${CMAKE_INSTALL_DATADIR}/offline_doc_studio/config)
install(FILES samples/session.ods DESTINATION ${CMAKE_INSTALL_DATADIR}/offline_doc_studio/samples)

set(CPACK_PACKAGE_NAME "OfflineDocStudio")
set(CPACK_PACKAGE_VENDOR "OfflineDocStudio Project")
set(CPACK_PACKAGE_VERSION ${PROJECT_VERSION})
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Offline document reader/annotator MVP shell")
set(CPACK_RESOURCE_FILE_README "${CMAKE_CURRENT_SOURCE_DIR}/README.md")
set(CPACK_GENERATOR "ZIP")
include(CPack)

#pragma once

#include "reading_settings.h"

#include <string>

namespace ods {

struct AppConfig {
    bool offline_mode = true;
    bool debug_logs = false;
    ReadingSettings reading;
};

class AppConfigStore {
public:
    explicit AppConfigStore(std::string root);

    [[nodiscard]] AppConfig Load() const;
    void Save(const AppConfig& config) const;

private:
    std::string root_;
};

} // namespace ods

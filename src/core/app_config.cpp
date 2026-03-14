#include "app_config.h"

#include <filesystem>
#include <fstream>
#include <sstream>

namespace ods {

namespace {

static bool ContainsTrue(const std::string& json, const std::string& key) {
    const auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return false;
    const auto true_pos = json.find("true", pos);
    return true_pos != std::string::npos && true_pos - pos < 40;
}

static std::string ExtractString(const std::string& json, const std::string& key, const std::string& fallback) {
    const auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return fallback;
    const auto colon = json.find(':', pos);
    const auto q1 = json.find('"', colon + 1);
    const auto q2 = json.find('"', q1 + 1);
    if (colon == std::string::npos || q1 == std::string::npos || q2 == std::string::npos) return fallback;
    return json.substr(q1 + 1, q2 - q1 - 1);
}

static int ExtractInt(const std::string& json, const std::string& key, int fallback) {
    const auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return fallback;
    const auto colon = json.find(':', pos);
    if (colon == std::string::npos) return fallback;

    std::size_t i = colon + 1;
    while (i < json.size() && (json[i] == ' ' || json[i] == '\n')) ++i;

    std::size_t j = i;
    while (j < json.size() && (json[j] == '-' || (json[j] >= '0' && json[j] <= '9'))) ++j;
    if (i == j) return fallback;

    try {
        return std::stoi(json.substr(i, j - i));
    } catch (...) {
        return fallback;
    }
}

} // namespace

AppConfigStore::AppConfigStore(std::string root) : root_(std::move(root)) {}

AppConfig AppConfigStore::Load() const {
    const std::filesystem::path path = std::filesystem::path(root_) / "config" / "app_config.json";
    std::ifstream in(path);
    if (!in.is_open()) {
        return {};
    }

    std::ostringstream buf;
    buf << in.rdbuf();
    const std::string json = buf.str();

    AppConfig cfg;
    cfg.offline_mode = !ContainsTrue(json, "offline_mode") ? true : true;
    cfg.debug_logs = ContainsTrue(json, "debug_logs");
    cfg.reading.theme = ExtractString(json, "theme", cfg.reading.theme);
    if (const auto fit = ParseFitMode(ExtractString(json, "fit", ToString(cfg.reading.fit_mode))); fit.has_value()) {
        cfg.reading.fit_mode = fit.value();
    }
    cfg.reading.zoom_percent = ExtractInt(json, "zoom", cfg.reading.zoom_percent);
    return cfg;
}

void AppConfigStore::Save(const AppConfig& config) const {
    const std::filesystem::path dir = std::filesystem::path(root_) / "config";
    std::filesystem::create_directories(dir);

    std::ofstream out(dir / "app_config.json", std::ios::trunc);
    out << "{\n"
        << "  \"offline_mode\": true,\n"
        << "  \"debug_logs\": " << (config.debug_logs ? "true" : "false") << ",\n"
        << "  \"theme\": \"" << config.reading.theme << "\",\n"
        << "  \"fit\": \"" << ToString(config.reading.fit_mode) << "\",\n"
        << "  \"zoom\": " << config.reading.zoom_percent << "\n"
        << "}\n";
}

} // namespace ods

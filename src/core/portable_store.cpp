#include "portable_store.h"

#include <filesystem>
#include <fstream>
#include <regex>
#include <sstream>

namespace ods {

PortableStore::PortableStore(std::string root_path) : root_(std::move(root_path)) {}

std::string PortableStore::ReadAll(const std::string& path) {
    std::ifstream input(path);
    if (!input.is_open()) {
        return {};
    }
    std::ostringstream buffer;
    buffer << input.rdbuf();
    return buffer.str();
}

void PortableStore::WriteAll(const std::string& path, const std::string& content) {
    std::filesystem::create_directories(std::filesystem::path(path).parent_path());
    std::ofstream output(path, std::ios::trunc);
    output << content;
}

std::string PortableStore::EscapeJson(const std::string& value) {
    std::string escaped;
    escaped.reserve(value.size());
    for (char c : value) {
        if (c == '"' || c == '\\') {
            escaped.push_back('\\');
        }
        escaped.push_back(c);
    }
    return escaped;
}

std::map<std::string, std::string> PortableStore::ParseBindings(const std::string& json) {
    std::map<std::string, std::string> result;
    const std::regex pair_re("\\\"([^\\\"]+)\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    auto begin = std::sregex_iterator(json.begin(), json.end(), pair_re);
    auto end = std::sregex_iterator();
    for (auto it = begin; it != end; ++it) {
        result[(*it)[1].str()] = (*it)[2].str();
    }
    return result;
}

std::vector<std::string> PortableStore::ParseStringArray(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\"";
    const std::size_t key_pos = json.find(needle);
    if (key_pos == std::string::npos) {
        return {};
    }

    const std::size_t open = json.find('[', key_pos);
    const std::size_t close = json.find(']', open == std::string::npos ? key_pos : open);
    if (open == std::string::npos || close == std::string::npos || close <= open) {
        return {};
    }

    const std::string body = json.substr(open + 1, close - open - 1);
    std::vector<std::string> items;
    const std::regex item_re("\\\"([^\\\"]+)\\\"");
    auto begin = std::sregex_iterator(body.begin(), body.end(), item_re);
    auto end = std::sregex_iterator();
    for (auto it = begin; it != end; ++it) {
        items.push_back((*it)[1].str());
    }
    return items;
}

std::map<std::string, std::string> PortableStore::LoadHotkeysFromPath(const std::string& path) {
    auto json = ReadAll(path);
    if (json.empty()) {
        return {
            {"open_file", "Ctrl+O"},
            {"find", "Ctrl+F"},
            {"screenshot", "Ctrl+Alt+X"},
            {"ocr_selection", "Ctrl+Shift+O"}
        };
    }

    const auto all_pairs = ParseBindings(json);
    std::map<std::string, std::string> bindings;
    for (const auto& [k, v] : all_pairs) {
        if (k != "version" && k != "bindings") {
            bindings[k] = v;
        }
    }
    return bindings;
}

void PortableStore::SaveHotkeysToPath(const std::string& path, const std::map<std::string, std::string>& bindings) {
    std::ostringstream out;
    out << "{\n  \"version\": 1,\n  \"bindings\": {\n";

    std::size_t index = 0;
    for (const auto& [action, hotkey] : bindings) {
        out << "    \"" << EscapeJson(action) << "\": \"" << EscapeJson(hotkey) << "\"";
        if (++index < bindings.size()) {
            out << ",";
        }
        out << "\n";
    }

    out << "  }\n}\n";
    WriteAll(path, out.str());
}

std::map<std::string, std::string> PortableStore::LoadHotkeys() const {
    return LoadHotkeysFromPath(root_ + "/config/hotkeys.json");
}

void PortableStore::SaveHotkeys(const std::map<std::string, std::string>& bindings) const {
    SaveHotkeysToPath(root_ + "/config/hotkeys.json", bindings);
}

LibraryData PortableStore::LoadLibrary() const {
    const std::string json = ReadAll(root_ + "/config/library.json");
    LibraryData data;
    data.recent = ParseStringArray(json, "recent");
    data.pinned = ParseStringArray(json, "pinned");
    return data;
}

void PortableStore::SaveLibrary(const LibraryData& library) const {
    std::ostringstream out;
    out << "{\n  \"recent\": [";
    for (std::size_t i = 0; i < library.recent.size(); ++i) {
        out << "\"" << EscapeJson(library.recent[i]) << "\"";
        if (i + 1 < library.recent.size()) {
            out << ", ";
        }
    }
    out << "],\n  \"pinned\": [";
    for (std::size_t i = 0; i < library.pinned.size(); ++i) {
        out << "\"" << EscapeJson(library.pinned[i]) << "\"";
        if (i + 1 < library.pinned.size()) {
            out << ", ";
        }
    }
    out << "]\n}\n";
    WriteAll(root_ + "/config/library.json", out.str());
}

SessionData PortableStore::LoadSession() const {
    const std::string json = ReadAll(root_ + "/config/session.json");
    SessionData data;
    data.tabs = ParseStringArray(json, "tabs");
    return data;
}

void PortableStore::SaveSession(const SessionData& session) const {
    std::ostringstream out;
    out << "{\n  \"tabs\": [";
    for (std::size_t i = 0; i < session.tabs.size(); ++i) {
        out << "\"" << EscapeJson(session.tabs[i]) << "\"";
        if (i + 1 < session.tabs.size()) {
            out << ", ";
        }
    }
    out << "],\n  \"active_index\": " << session.active_index << "\n}\n";
    WriteAll(root_ + "/config/session.json", out.str());
}

} // namespace ods

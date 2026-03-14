#pragma once

#include <map>
#include <string>
#include <vector>

namespace ods {

struct LibraryData {
    std::vector<std::string> recent;
    std::vector<std::string> pinned;
};

struct SessionData {
    std::vector<std::string> tabs;
    int active_index = 0;
};

class PortableStore {
public:
    explicit PortableStore(std::string root_path);

    std::map<std::string, std::string> LoadHotkeys() const;
    void SaveHotkeys(const std::map<std::string, std::string>& bindings) const;

    static std::map<std::string, std::string> LoadHotkeysFromPath(const std::string& path);
    static void SaveHotkeysToPath(const std::string& path, const std::map<std::string, std::string>& bindings);

    LibraryData LoadLibrary() const;
    void SaveLibrary(const LibraryData& library) const;

    SessionData LoadSession() const;
    void SaveSession(const SessionData& session) const;

private:
    std::string root_;

    static std::vector<std::string> ParseStringArray(const std::string& json, const std::string& key);
    static std::map<std::string, std::string> ParseBindings(const std::string& json);
    static std::string EscapeJson(const std::string& value);
    static std::string ReadAll(const std::string& path);
    static void WriteAll(const std::string& path, const std::string& content);
};

} // namespace ods

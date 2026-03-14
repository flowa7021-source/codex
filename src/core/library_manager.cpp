#include "library_manager.h"

#include <algorithm>
#include <cctype>
#include <filesystem>

namespace ods {

static std::string ToLower(const std::string& s) {
    std::string out = s;
    std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return out;
}

LibraryManager::LibraryManager(PortableStore& store, const FormatRegistry& formats)
    : store_(store), formats_(formats), data_(store.LoadLibrary()) {}

void LibraryManager::ImportFolder(const std::string& folder) {
    namespace fs = std::filesystem;
    if (!fs::exists(folder) || !fs::is_directory(folder)) {
        return;
    }

    for (const auto& entry : fs::directory_iterator(folder)) {
        if (!entry.is_regular_file()) {
            continue;
        }
        const std::string path = entry.path().string();
        if (!formats_.Supports(path)) {
            continue;
        }

        if (std::find(data_.recent.begin(), data_.recent.end(), path) == data_.recent.end()) {
            data_.recent.push_back(path);
        }
    }
}

void LibraryManager::AddRecent(const std::string& path) {
    data_.recent.erase(std::remove(data_.recent.begin(), data_.recent.end(), path), data_.recent.end());
    data_.recent.insert(data_.recent.begin(), path);
    if (data_.recent.size() > 50) {
        data_.recent.resize(50);
    }
}

void LibraryManager::Pin(const std::string& path) {
    if (std::find(data_.pinned.begin(), data_.pinned.end(), path) == data_.pinned.end()) {
        data_.pinned.push_back(path);
    }
}

void LibraryManager::Unpin(const std::string& path) {
    data_.pinned.erase(std::remove(data_.pinned.begin(), data_.pinned.end(), path), data_.pinned.end());
}

std::vector<std::string> LibraryManager::Search(const std::string& query) const {
    std::vector<std::string> results;
    const std::string q = ToLower(query);

    for (const auto& path : data_.recent) {
        if (ToLower(path).find(q) != std::string::npos) {
            results.push_back(path);
        }
    }
    for (const auto& path : data_.pinned) {
        if (ToLower(path).find(q) != std::string::npos &&
            std::find(results.begin(), results.end(), path) == results.end()) {
            results.push_back(path);
        }
    }
    return results;
}

const LibraryData& LibraryManager::Data() const {
    return data_;
}

void LibraryManager::Persist() const {
    store_.SaveLibrary(data_);
}

} // namespace ods

#pragma once

#include "plugins/format_registry.h"
#include "portable_store.h"

#include <string>
#include <vector>

namespace ods {

class LibraryManager {
public:
    LibraryManager(PortableStore& store, const FormatRegistry& formats);

    void ImportFolder(const std::string& folder);
    void AddRecent(const std::string& path);
    void Pin(const std::string& path);
    void Unpin(const std::string& path);

    [[nodiscard]] std::vector<std::string> Search(const std::string& query) const;
    [[nodiscard]] const LibraryData& Data() const;
    void Persist() const;

private:
    PortableStore& store_;
    const FormatRegistry& formats_;
    LibraryData data_;
};

} // namespace ods

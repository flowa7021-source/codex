#pragma once

#include "core/document_model.h"

#include <optional>
#include <string>
#include <vector>

namespace ods {

class FormatRegistry {
public:
    [[nodiscard]] bool Supports(const std::string& path) const;
    [[nodiscard]] std::optional<DocumentModel> Open(const std::string& path) const;
    [[nodiscard]] std::vector<std::string> SupportedFormats() const;

private:
    [[nodiscard]] static std::string Extension(const std::string& path);
};

} // namespace ods

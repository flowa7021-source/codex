#pragma once

#include "document_model.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace ods {

class OcrIndex {
public:
    void IndexDocument(const DocumentModel& document);
    [[nodiscard]] std::vector<std::size_t> FindPages(const std::string& document_path, const std::string& query) const;

private:
    std::map<std::string, std::map<std::string, std::vector<std::size_t>>> index_;
    static std::vector<std::string> Tokenize(const std::string& text);
    static std::string Normalize(const std::string& text);
};

} // namespace ods

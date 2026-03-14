#include "ocr_index.h"

#include <algorithm>
#include <cctype>
#include <sstream>

namespace ods {

std::string OcrIndex::Normalize(const std::string& text) {
    std::string out;
    out.reserve(text.size());
    for (char c : text) {
        out.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
    }
    return out;
}

std::vector<std::string> OcrIndex::Tokenize(const std::string& text) {
    std::string normalized = Normalize(text);
    for (char& c : normalized) {
        if (!std::isalnum(static_cast<unsigned char>(c))) {
            c = ' ';
        }
    }

    std::vector<std::string> tokens;
    std::istringstream in(normalized);
    std::string token;
    while (in >> token) {
        tokens.push_back(token);
    }
    return tokens;
}

void OcrIndex::IndexDocument(const DocumentModel& document) {
    auto& by_token = index_[document.path];
    by_token.clear();

    for (std::size_t i = 0; i < document.pages.size(); ++i) {
        const auto tokens = Tokenize(document.pages[i].content);
        for (const auto& token : tokens) {
            auto& pages = by_token[token];
            if (pages.empty() || pages.back() != i + 1) {
                pages.push_back(i + 1);
            }
        }
    }
}

std::vector<std::size_t> OcrIndex::FindPages(const std::string& document_path, const std::string& query) const {
    const auto doc_it = index_.find(document_path);
    if (doc_it == index_.end()) {
        return {};
    }

    const auto token = Normalize(query);
    const auto token_it = doc_it->second.find(token);
    if (token_it == doc_it->second.end()) {
        return {};
    }
    return token_it->second;
}

} // namespace ods

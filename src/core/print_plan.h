#pragma once

#include <optional>
#include <string>
#include <vector>

namespace ods {

struct PrintPlan {
    std::vector<std::size_t> pages;
    bool include_annotations = true;
};

std::optional<PrintPlan> ParsePrintPlan(const std::string& ranges, std::size_t page_count, bool include_annotations);

} // namespace ods

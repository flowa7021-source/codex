#include "print_plan.h"

#include <algorithm>
#include <cctype>
#include <sstream>

namespace ods {

static bool ParseRangeToken(const std::string& token, std::size_t page_count, std::vector<std::size_t>& output) {
    const auto dash = token.find('-');
    if (dash == std::string::npos) {
        const std::size_t page = static_cast<std::size_t>(std::stoul(token));
        if (page == 0 || page > page_count) {
            return false;
        }
        output.push_back(page);
        return true;
    }

    const std::size_t from = static_cast<std::size_t>(std::stoul(token.substr(0, dash)));
    const std::size_t to = static_cast<std::size_t>(std::stoul(token.substr(dash + 1)));
    if (from == 0 || to == 0 || from > to || to > page_count) {
        return false;
    }
    for (std::size_t page = from; page <= to; ++page) {
        output.push_back(page);
    }
    return true;
}

std::optional<PrintPlan> ParsePrintPlan(const std::string& ranges, std::size_t page_count, bool include_annotations) {
    if (page_count == 0) {
        return std::nullopt;
    }

    PrintPlan plan;
    plan.include_annotations = include_annotations;

    if (ranges.empty() || ranges == "all") {
        for (std::size_t i = 1; i <= page_count; ++i) {
            plan.pages.push_back(i);
        }
        return plan;
    }

    std::stringstream ss(ranges);
    std::string token;
    while (std::getline(ss, token, ',')) {
        token.erase(std::remove_if(token.begin(), token.end(), [](unsigned char c) { return std::isspace(c); }), token.end());
        if (token.empty()) {
            continue;
        }
        if (!ParseRangeToken(token, page_count, plan.pages)) {
            return std::nullopt;
        }
    }

    std::sort(plan.pages.begin(), plan.pages.end());
    plan.pages.erase(std::unique(plan.pages.begin(), plan.pages.end()), plan.pages.end());
    return plan;
}

} // namespace ods

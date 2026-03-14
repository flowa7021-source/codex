#pragma once

#include <string>

namespace ods {

class Logger {
public:
    explicit Logger(std::string root);
    void Info(const std::string& message) const;

private:
    std::string root_;
};

} // namespace ods

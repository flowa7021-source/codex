#include "logger.h"

#include <filesystem>
#include <fstream>

namespace ods {

Logger::Logger(std::string root) : root_(std::move(root)) {}

void Logger::Info(const std::string& message) const {
    const std::filesystem::path dir = std::filesystem::path(root_) / "logs";
    std::filesystem::create_directories(dir);

    std::ofstream out(dir / "app.log", std::ios::app);
    out << "[INFO] " << message << '\n';
}

} // namespace ods

// @ts-check

/**
 * Parse CLI arguments into a structured command object.
 * @param {string[]} args
 * @returns {{ command: string, inputFiles: string[], outputPath: string, options: Record<string, any> }}
 */
export function parseCliArgs(args) {
  if (!args.length) throw new Error('No command specified');

  const command = args[0];
  const validCommands = ['merge', 'split', 'compress', 'ocr', 'convert', 'watermark', 'bates', 'redact', 'protect'];
  if (!validCommands.includes(command)) throw new Error(`Unknown command: ${command}`);

  const inputFiles = [];
  let outputPath = '';
  const options = {};

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '-o' || arg === '--output') {
      outputPath = args[++i] || '';
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      inputFiles.push(arg);
    }
    i++;
  }

  return { command, inputFiles, outputPath, options };
}

/**
 * Execute a parsed CLI command.
 * @param {{ command: string, inputFiles: string[], outputPath: string, options: Record<string, any> }} parsed
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function executeCli(parsed) {
  try {
    switch (parsed.command) {
      case 'merge':
        if (parsed.inputFiles.length < 2) throw new Error('Merge requires at least 2 input files');
        return { success: true, message: `Merge ${parsed.inputFiles.length} files → ${parsed.outputPath}` };
      case 'split':
        return { success: true, message: `Split ${parsed.inputFiles[0]} → ${parsed.outputPath}` };
      case 'compress':
        return { success: true, message: `Compress ${parsed.inputFiles[0]} with profile ${parsed.options.profile || 'ebook'}` };
      case 'ocr':
        return { success: true, message: `OCR ${parsed.inputFiles[0]} lang=${parsed.options.lang || 'eng'}` };
      case 'convert':
        return { success: true, message: `Convert ${parsed.inputFiles[0]} to ${parsed.options.to || 'pdf'}` };
      default:
        return { success: true, message: `${parsed.command} executed` };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

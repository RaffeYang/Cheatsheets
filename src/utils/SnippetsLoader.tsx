import * as fs from "fs"
import os from "os"
import * as path from "path"

import type { Snippet } from "../types"
import loadMarkdown from "./MarkdownLoader"

const supportedExtensions = [".md", ".txt"]
// 添加要排除的文件名列表
const excludedFileNames = ["README.md", "readme.md", "Readme.md"]

async function loadAllSnippets(startPath: string): Promise<{ snippets: Snippet[]; errors: Error[] }> {
  const snippets: Snippet[] = []
  const errors: Error[] = []

  async function readDirectory(directoryPath: string): Promise<void> {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true })

    // Array to store promises for file processing
    const filePromises: Promise<void>[] = []

    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name)

      if (!entry.name.startsWith(".")) {
        const extension = path.extname(entry.name)
        if (entry.isDirectory()) {
          // Queue directory processing concurrently
          filePromises.push(readDirectory(fullPath))
        } else if (
          supportedExtensions.includes(extension) && 
          // 添加文件名过滤条件
          !excludedFileNames.includes(entry.name)
        ) {
          // Queue file processing concurrently
          filePromises.push(processFile(fullPath))
        }
      }
    }

    // Wait for all files and directories to be processed
    await Promise.all(filePromises)
  }

  async function processFile(fullPath: string): Promise<void> {
    const relativePath = path.relative(startPath, fullPath)
    const { snippet, error } = await loadMarkdown(relativePath, fullPath)
    snippets.push(snippet)
    if (error) {
      errors.push(error)
    }
  }

  await readDirectory(startPath)
  return { snippets, errors }
}

function expandHomeDirectory(dirPath: string): string {
  if (dirPath.startsWith("~")) {
    return path.join(os.homedir(), dirPath.slice(1))
  } else {
    return dirPath
  }
}

function getPastableContent(content: string): string {
  if (!content) {
    return ""
  }

  let pastableContent = content
  if (content.startsWith("```") && content.endsWith("```")) {
    const tmp = content.split("\n")
    const extractedLines = tmp.slice(1, tmp.length - 1)
    pastableContent = extractedLines.join("\n")
  }
  return pastableContent
}

export { expandHomeDirectory, getPastableContent, loadAllSnippets }

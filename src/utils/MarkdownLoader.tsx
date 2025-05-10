import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import { parse } from "yaml"
import { Snippet, SnippetContent } from "../types"

function extractMetadataContent(
  relativePath: string,
  fileContent: string
): { content: SnippetContent; error: Error | null } {
  const lines = fileContent.split("\n")

  let metadataEndIndex = 0
  let contentStartIndex = 0
  let hasMetadata = false

  // Check if the file starts with a metadata block
  if (lines.length > 0 && lines[0].trim() === "---") {
    hasMetadata = true
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === "---") {
        metadataEndIndex = i
        contentStartIndex = i + 1
        break
      }
    }
  }

  let metadata: Record<string, unknown> = {}
  let tags: string[] = []
  const error = null

  if (hasMetadata) {
    // Replaces all tab characters with four spaces, otherwise the `parse(rawMetadata)` will throw an error
    const rawMetadata = lines.slice(1, metadataEndIndex).join("\n").replace(/\t/g, "    ")
    
    try {
      // Wrap the YAML parsing in a try-catch to handle any parsing errors
      metadata = parse(rawMetadata) as Record<string, unknown>
      
      // Parse tags (case-insensitive)
      const tagsKey = getCaseInsensitiveKey(metadata, "tags") || "Tags"
      if (tagsKey && metadata[tagsKey] && Array.isArray(metadata[tagsKey])) {
        const rawTags = metadata[tagsKey] as unknown[]
        if (!rawTags.some((tag) => typeof tag !== "string")) {
          tags = rawTags as string[]
        }
      }
    } catch (e) {
      console.warn(`Warning: Error parsing metadata for ${relativePath}`, e)
      // Don't set error here, just log a warning and continue
    }
  }

  // If no metadata block or parsing failed, use the entire content
  const content = hasMetadata 
    ? lines.slice(contentStartIndex).join("\n").trim()
    : fileContent.trim()

  const titleKey = getCaseInsensitiveKey(metadata, "title") || "Title"
  const descriptionKey = getCaseInsensitiveKey(metadata, "description") || "Description"
  
  const snippetContent: SnippetContent = {
    title: titleKey && metadata[titleKey] ? String(metadata[titleKey]) : path.basename(relativePath, path.extname(relativePath)),
    description: descriptionKey && metadata[descriptionKey] ? String(metadata[descriptionKey]) : "",
    tags: tags,
    content: content,
    rawMetadata: hasMetadata ? lines.slice(1, metadataEndIndex).join("\n") : "",
  }
  
  return { content: snippetContent, error: error }
}

async function readFileContent(
  relativePath: string,
  fullPath: string
): Promise<{ content: SnippetContent; error: Error | null }> {
  const fileContent = await fs.promises.readFile(fullPath, "utf8")
  return extractMetadataContent(relativePath, fileContent)
}

async function loadMarkdown(
  relativePath: string,
  fullPath: string
): Promise<{ snippet: Snippet; error: Error | null }> {
  const parsedName = path.parse(fullPath).name

  const hash = crypto.createHash("md5")
  hash.update(fullPath)
  const id = hash.digest("hex")

  const { content, error } = await readFileContent(relativePath, fullPath)
  const snippet: Snippet = {
    id: id,
    folder: path.dirname(relativePath),
    name: content.title ?? parsedName,
    content: content,
  }
  return { snippet: snippet, error: error }
}

function getCaseInsensitiveKey(metadata: Record<string, unknown>, key: string): string | undefined {
  if (!metadata) {
    return undefined
  }
  return Object.keys(metadata).find((k) => k.toLowerCase() === key.toLowerCase())
}

export default loadMarkdown

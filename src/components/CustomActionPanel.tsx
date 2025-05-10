import { Action, ActionPanel, Icon } from "@raycast/api"
import * as path from "path"
import type { Snippet } from "../types"
import { getPastableContent } from "../utils/SnippetsLoader"

const CustomActionPanel = ({
  handleAction,
  snippet,
  reloadSnippets,
  paths,
}: {
  handleAction: (s: Snippet) => void
  snippet: Snippet
  primaryAction: string
  reloadSnippets: () => void
  paths: string[]
}) => {
  // 获取文件的完整路径
  const getFullPath = () => {
    const folderPath = paths[0] // 使用主文件夹
    const relativePath = snippet.folder === "." ? snippet.name : path.join(snippet.folder, snippet.name)
    // 添加文件扩展名（如果没有）
    const fileExtension = path.extname(relativePath) || ".md"
    const fullPath = path.join(folderPath, relativePath + (path.extname(relativePath) ? "" : fileExtension))
    return fullPath
  }

  return (
    <>
      <ActionPanel.Section title="Actions">
        <Action.ShowInFinder 
          title="Open in Finder"
          path={getFullPath()}
          shortcut={{ modifiers: ["cmd"], key: "o" }}
          onShow={() => {
            handleAction(snippet)
          }}
        />
        <Action.CopyToClipboard
          title="Copy Content"
          content={getPastableContent(snippet.content?.content)}
          shortcut={{ modifiers: ["cmd"], key: "c" }}
          onCopy={() => {
            handleAction(snippet)
          }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="Others">
        <Action
          title="Reload Snippets"
          icon={Icon.RotateAntiClockwise}
          onAction={reloadSnippets}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
        />
        {paths && paths.length > 0 && (
          <Action.OpenWith
            title="Open Primary Snippets Folder"
            path={paths[0]}
            shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
          />
        )}
        {paths && paths.length > 1 && paths.slice(1).map((p, index) => {
          const lastDir = path.basename(p)
          return (
            <Action.OpenWith 
              key={`secondary-folder-${index}`}
              title={`Open Secondary Snippets Folder ${lastDir}`} 
              path={p} 
            />
          )
        })}
      </ActionPanel.Section>
    </>
  )
}

export default CustomActionPanel

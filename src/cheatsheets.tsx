import { Action, ActionPanel, clearSearchBar, getPreferenceValues, Icon, List, showToast, Toast } from "@raycast/api"
import { useEffect, useState } from "react"
import CustomActionPanel from "./components/CustomActionPanel"
import type { Snippet, State } from "./types"
import { clearUnusedSnippets, orderSnippets, storeLastCopied } from "./utils/LocalStorageHelper"
import { expandHomeDirectory, loadAllSnippets } from "./utils/SnippetsLoader"

// Heading type definition
interface Heading {
  level: number
  text: string
  startIndex: number
  endIndex: number
  id: string // 唯一ID字段
}

export default function Command() {
  const [state, setState] = useState<State>({ snippets: [], isLoading: true })
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [selectedHeading, setSelectedHeading] = useState<Heading | null>(null)

  const handleAction = async function (snippet: Snippet) {
    await storeLastCopied(snippet)

    const orderedSnippets = await orderSnippets(state.snippets ?? [])
    const filteredSnippets = await orderSnippets(state.filteredSnippets ?? state.snippets ?? [])
    setState((previous) => ({ ...previous, snippets: orderedSnippets, filteredSnippets: filteredSnippets }))
  }

  // 修改 setSelectedSnippet 函数，在选择 snippet 时清空搜索框
  const handleSelectSnippet = async (snippet: Snippet) => {
    setSelectedSnippet(snippet)
    // 添加延迟和错误处理
    setTimeout(async () => {
      try {
        await clearSearchBar()
      } catch (error) {
        console.error("Failed to clear search bar:", error)
      }
    }, 100)
  }

  // 返回到 snippets 列表
  const handleBackToSnippets = () => {
    setSelectedSnippet(null)
  }

  // Fetch primary action preference
  useEffect(() => {
    const fetch = async () => {
      const preferences = getPreferenceValues()
      const primaryAction = preferences["primaryAction"]
      setState((previous) => ({ ...previous, primaryAction: primaryAction }))
    }
    fetch()
  }, [])

  // Initial data fetch
  const fetchData = async () => {
    try {
      const preferences = getPreferenceValues()
      const path = preferences["folderPath"]
      const allPathsTmp = preferences["secondaryFolderPaths"]
        ? [path, ...preferences["secondaryFolderPaths"].split(",")]
        : [path]
      const allPaths = Array.from(new Set(allPathsTmp.map(expandHomeDirectory)))

      const snippetsPromises = allPaths.map(loadAllSnippets)
      const snippetsArrays = await Promise.all(snippetsPromises)
      const snippets = snippetsArrays.flatMap(({ snippets }) => snippets)
      const errors = snippetsArrays.flatMap(({ errors }) => errors)

      const folders = Array.from(
        new Set(
          snippets.map((i) => {
            return i.folder
          })
        )
      )

      const tags = Array.from(
        new Set(
          snippets.flatMap((i) => {
            return i.content.tags ?? []
          })
        )
      )

      await clearUnusedSnippets(snippets)
      const orderedSnippets = await orderSnippets(snippets)

      setState((previous) => ({
        ...previous,
        snippets: orderedSnippets,
        filteredSnippets: orderedSnippets,
        folders: folders,
        tags: tags,
        paths: allPaths,
        errors: errors,
      }))
    } catch (err) {
      setState((previous) => ({
        ...previous,
        errors: [err instanceof Error ? err : new Error("Something went wrong")],
      }))
    }

    setState((previous) => ({ ...previous, isLoading: false }))
  }
  useEffect(() => {
    fetchData()
  }, [])

  // Handle filter folder
  useEffect(() => {
    if (state.selectedFilter && state.selectedFilter != "all") {
      const handleFilterByFolder = (snippet: Snippet, filterValue: string) => {
        return snippet.folder == filterValue
      }
      const handleFilterByTags = (snippet: Snippet, filterValue: string) => {
        return snippet.content.tags?.includes(filterValue)
      }

      if (state.snippets) {
        // 修改函数签名，使用 eslint-disable-next-line 来忽略未使用参数的警告
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let handleFilterMethod = (snippet: Snippet) => true
        if (state.selectedFilter.startsWith("folder:")) {
          const filterValue = state.selectedFilter.substring("folder:".length)
          handleFilterMethod = (snippet: Snippet) => {
            return handleFilterByFolder(snippet, filterValue)
          }
        } else if (state.selectedFilter.startsWith("tag:")) {
          const filterValue = state.selectedFilter.substring("tag:".length)
          handleFilterMethod = (snippet: Snippet) => {
            return handleFilterByTags(snippet, filterValue)
          }
        }

        const res = state.snippets.filter(handleFilterMethod)
        setState((previous) => ({ ...previous, filteredSnippets: res }))
      }
    } else {
      setState((previous) => ({ ...previous, filteredSnippets: state.snippets }))
    }
  }, [state.selectedFilter])

  // Extract headings when a snippet is selected
  useEffect(() => {
    if (selectedSnippet) {
      const extractedHeadings = extractHeadings(selectedSnippet.content.content)
      setHeadings(extractedHeadings)
      
      // Select the first heading by default
      if (extractedHeadings.length > 0) {
        setSelectedHeading(extractedHeadings[0])
      } else {
        setSelectedHeading(null)
      }
    } else {
      setHeadings([])
      setSelectedHeading(null)
    }
  }, [selectedSnippet])

  if (state.errors && state.errors.length != 0) {
    const options: Toast.Options = {
      style: Toast.Style.Failure,
      title: "Error loading snippets.",
      message: state.errors?.map((e) => e.message).join("\n"),
    }
    showToast(options)
  }

  // If a snippet is selected, show the headings list with detail
  if (selectedSnippet) {
    return (
      <List
        navigationTitle={selectedSnippet.name}
        searchBarPlaceholder="Search headings..."
        isShowingDetail
        onSelectionChange={(id) => {
          if (id) {
            const heading = headings.find((h) => h.id === id)
            if (heading) {
              setSelectedHeading(heading)
            }
          }
        }}
        actions={
          <ActionPanel>
            <Action title="Back to Snippets" icon={Icon.ArrowLeft} onAction={handleBackToSnippets} />
          </ActionPanel>
        }
      >
        {headings.length === 0 ? (
          <List.EmptyView
            icon={Icon.Document}
            title="No headings found"
            description="This document doesn't contain any headings."
            actions={
              <ActionPanel>
                <Action title="Back to Snippets" icon={Icon.ArrowLeft} 
                  onAction={handleBackToSnippets}
                />
                <Action.CopyToClipboard
                  title="Copy Content"
                  content={selectedSnippet.content.content}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
                <Action.Paste
                  title="Paste to Active App"
                  content={selectedSnippet.content.content}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "p" }} // 修改为 cmd+shift+p
                />
              </ActionPanel>
            }
          />
        ) : (
          headings.map((heading) => (
            <List.Item
              key={heading.id} // 使用唯一ID作为key
              id={heading.id} // 使用唯一ID作为id，而不是text
              title={heading.text}
              icon={heading.level === 1 ? Icon.Heading : heading.level === 2 ? Icon.Dot : Icon.Circle}
              accessories={[{ text: heading.level === 1 ? "H1" : heading.level === 2 ? "H2" : "H3" }]}
              detail={
                <List.Item.Detail
                  markdown={
                    selectedHeading
                      ? extractSectionContent(selectedSnippet.content.content, selectedHeading)
                      : selectedSnippet.content.content
                  }
                  metadata={
                    selectedSnippet.content.tags && selectedSnippet.content.tags.length > 0 ? (
                      <List.Item.Detail.Metadata>
                        <List.Item.Detail.Metadata.TagList title="Tags">
                          {selectedSnippet.content.tags.map((tag, tagIndex) => (
                            <List.Item.Detail.Metadata.TagList.Item text={tag} key={`tag-${tag}-${tagIndex}`} />
                          ))}
                        </List.Item.Detail.Metadata.TagList>
                      </List.Item.Detail.Metadata>
                    ) : null
                  }
                />
              }
              actions={
                <ActionPanel>
                  <Action title="Back to Snippets" icon={Icon.ArrowLeft} onAction={handleBackToSnippets} />
                  <Action.CopyToClipboard
                    title="Copy Section"
                    content={extractSectionContent(selectedSnippet.content.content, heading)}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                  <Action.CopyToClipboard
                    title="Copy Full Content"
                    content={selectedSnippet.content.content}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                </ActionPanel>
              }
            />
          ))
        )}
      </List>
    )
  }

  // Main snippets list
  const loadSnippetsView = state.filteredSnippets && state.filteredSnippets.length != 0
  return (
    <List
      searchBarPlaceholder="Type to search snippets"
      isLoading={state.isLoading}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter on folder"
          storeValue={true}
          onChange={(newValue) => {
            setState((previous) => ({ ...previous, selectedFilter: newValue }))
          }}
        >
          <List.Dropdown.Item title="All" value="all" />
          {state.folders && state.folders.length != 1 && (
            <List.Dropdown.Section title="Folders">
              {state.folders.map((i, index) => {
                return <List.Dropdown.Item title={i} value={`folder:${i}`} key={`folder-${i}-${index}`} />
              })}
            </List.Dropdown.Section>
          )}
          {state.tags && state.tags.length != 0 && (
            <List.Dropdown.Section title="Tags">
              {state.tags.map((i, index) => {
                return <List.Dropdown.Item title={i} value={`tag:${i}`} key={`tag-${i}-${index}`} />
              })}
            </List.Dropdown.Section>
          )}
        </List.Dropdown>
      }
    >
      {!loadSnippetsView && (
        <List.EmptyView
          icon={Icon.Snippets}
          title="No Snippets."
          description="Why not create a few?

            Visit https://www.raycast.com/astronight/snippetsurfer for examples."
          actions={
            <ActionPanel>
              <Action
                title="Reload Snippets"
                icon={Icon.RotateAntiClockwise}
                onAction={fetchData}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
              />
            </ActionPanel>
          }
        />
      )}
      {loadSnippetsView &&
        state.filteredSnippets?.map((i) => {
          return (
            <List.Item
              id={i.id}
              key={i.id}
              title={i.name}
              accessories={[{ icon: Icon.Folder, text: i.folder && i.folder !== "." ? i.folder : "" }]}
              keywords={[i.folder, ...i.content.content.split(" ").concat(i.content.rawMetadata.split(" "))]}
              icon={Icon.Document}
              actions={
                <ActionPanel>
                  <Action 
                    title="Open" 
                    icon={Icon.Eye} 
                    onAction={() => handleSelectSnippet(i)} // 使用新的处理函数
                  />
                  <CustomActionPanel
                    handleAction={handleAction}
                    snippet={i}
                    primaryAction={state.primaryAction ?? ""}
                    reloadSnippets={fetchData}
                    paths={state.paths ?? []}
                  />
                </ActionPanel>
              }
            />
          )
        })}
    </List>
  )
}

// Function to extract headings from markdown content
function extractHeadings(content: string): Heading[] {
  // Only match headings at the beginning of a line, and ignore code blocks
  const headingRegex = /^(#{1,3})\s+(.+)$/gm
  const codeBlockRegex = /```[\s\S]*?```/g
  
  // Replace code blocks with placeholders to avoid matching headings inside code blocks
  const codeBlocks: string[] = []
  const contentWithoutCodeBlocks = content.replace(codeBlockRegex, (match) => {
    codeBlocks.push(match)
    return `CODE_BLOCK_${codeBlocks.length - 1}`
  })
  
  const headings: Heading[] = []
  let match
  let headingId = 0 // 添加计数器用于生成唯一ID

  // Find all headings in the content without code blocks
  while ((match = headingRegex.exec(contentWithoutCodeBlocks)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    
    if (text.startsWith('!')) {
      continue
    }
    
    const startIndex = match.index
    
    headings.push({
      level,
      text,
      startIndex,
      endIndex: content.length, // Default end is end of content, will update below
      id: `heading-${level}-${headingId++}` // 添加唯一ID，只使用level和递增的ID，不使用text
    })
  }

  // Calculate end index for each heading (start of next heading or end of content)
  for (let i = 0; i < headings.length - 1; i++) {
    headings[i].endIndex = headings[i + 1].startIndex
  }

  return headings
}

// Function to extract section content for a heading
function extractSectionContent(content: string, heading: Heading): string {
  // Find the heading in the original content
  const headingRegex = new RegExp(`^${heading.level === 1 ? '#' : heading.level === 2 ? '##' : '###'}\\s+${escapeRegExp(heading.text)}`, 'm')
  const match = headingRegex.exec(content)
  
  if (!match) {
    return `# ${heading.text}\n\nSection not found.`
  }
  
  const startIndex = match.index
  
  // Find the next heading of same or higher level
  const nextHeadingRegex = new RegExp(`^#{1,${heading.level}}\\s+`, 'm')
  const remainingContent = content.substring(startIndex + match[0].length)
  const nextHeadingMatch = nextHeadingRegex.exec(remainingContent)
  
  // Return the heading and its content
  return `${match[0]}\n\n${remainingContent.substring(0, nextHeadingMatch ? nextHeadingMatch.index : remainingContent.length).trim()}`
}

// Helper function to escape special characters in regular expressions
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

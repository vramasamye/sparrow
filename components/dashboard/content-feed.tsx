import { prisma } from "@/lib/db"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Sparkles } from "lucide-react"

export async function ContentFeed() {
  const content = await prisma.content.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { feed: true },
  }).catch(() => [])

  if (content.length === 0) {
    return (
      <div className="text-center py-12">
        <Rss className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No content yet</h3>
        <p className="text-gray-600 mb-4">
          Add your first RSS feed to start curating content
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {content.map((item) => (
        <div
          key={item.id}
          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
              {item.optimizedTitle && (
                <div className="flex items-center text-sm text-blue-600 mb-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  <span className="italic">{item.optimizedTitle}</span>
                </div>
              )}
            </div>
            {item.qualityScore && (
              <Badge variant={item.qualityScore > 70 ? "default" : "secondary"}>
                {Math.round(item.qualityScore)}%
              </Badge>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {item.summary || item.description}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>{item.feed.name}</span>
              <span>{formatDateTime(item.publishedAt)}</span>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-600 hover:underline"
            >
              Read more
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>

          {item.suggestedTags && item.suggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {item.suggestedTags.slice(0, 5).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Rss({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  )
}

import { parseRoute, useHash } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EditorPage } from '@/features/editor/EditorPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'

export function App() {
  const route = parseRoute(useHash())

  return (
    <TooltipProvider delayDuration={400}>
      {route.name === 'editor' ? <EditorPage key={route.projectId} projectId={route.projectId} /> : <ProjectsPage />}
      <Toaster position="bottom-center" />
    </TooltipProvider>
  )
}

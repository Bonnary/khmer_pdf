import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/edit/edit-pdf')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/edit/edit-pdf"!</div>
}

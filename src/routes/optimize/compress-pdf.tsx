import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/optimize/compress-pdf')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/optimize/compress-pdf"!</div>
}

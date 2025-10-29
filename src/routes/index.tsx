import { createFileRoute, Link } from '@tanstack/react-router'
import type { FileRouteTypes } from '@/routeTree.gen'
import { useState } from 'react'
import {
  FileText,
  Scissors,
  Minimize2,
  FileEdit,
  Download,
  Upload,
  RefreshCw,
  Lock,
  Unlock,
  Stamp,
  Grid3x3,
  Image,
  Pen,
  Crop,
  Hash,
  Search,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: App,
})

interface Tool {
  name: string
  description: string
  icon: React.ReactNode
  badge?: string
  category: string[]
  link: FileRouteTypes['to']
}

const tools: Tool[] = [
  {
    name: 'Merge PDF',
    description:
      'Combine PDFs in the order you want with the easiest PDF merger available.',
    icon: <FileText className="w-8 h-8" />,
    category: ['all', 'organize'],
    link: '/organize/merge-pdf',
  },
  {
    name: 'Split PDF',
    description:
      'Separate one page or a whole set for easy conversion into independent PDF files.',
    icon: <Scissors className="w-8 h-8" />,
    category: ['all', 'organize'],
    link: '/organize/split-pdf',
  },
  {
    name: 'Compress PDF',
    description: 'Reduce file size while optimizing for maximal PDF quality.',
    icon: <Minimize2 className="w-8 h-8" />,
    category: ['all', 'optimize'],
    link: '/optimize/compress-pdf',
  },
  {
    name: 'PDF to Word',
    description:
      'Easily convert your PDF files into easy to edit DOC and DOCX documents.',
    icon: <Download className="w-8 h-8" />,
    category: ['all', 'convert'],
    link: '/convert/pdf-to-word',
  },
  {
    name: 'PDF to PowerPoint',
    description:
      'Turn your PDF files into easy to edit PPT and PPTX slideshows.',
    icon: <Download className="w-8 h-8" />,
    category: ['all', 'convert'],
    link: '/',
  },
  {
    name: 'Word to PDF',
    description:
      'Make DOC and DOCX files easy to read by converting them to PDF.',
    icon: <Upload className="w-8 h-8" />,
    category: ['all', 'convert'],
    link: '/',
  },
  {
    name: 'PowerPoint to PDF',
    description:
      'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
    icon: <Upload className="w-8 h-8" />,
    category: ['all', 'convert'],
    link: '/',
  },
  {
    name: 'Edit PDF',
    description:
      'Add text, images, shapes or freehand annotations to a PDF document.',
    icon: <FileEdit className="w-8 h-8" />,
    badge: 'New',
    category: ['all', 'edit'],
    link: '/edit/edit-pdf',
  },
  {
    name: 'PDF to JPG',
    description:
      'Convert each PDF page into a JPG or extract all images contained in a PDF.',
    icon: <Image className="w-8 h-8" />,
    category: ['all', 'convert'],
    link: '/',
  },
  {
    name: 'JPG to PDF',
    description:
      'Convert JPG images to PDF in seconds. Easily adjust orientation and margins.',
    icon: <Image className="w-8 h-8" />,
    category: ['all', 'convert'],
    link: '/',
  },
  {
    name: 'Sign PDF',
    description: 'Sign yourself or request electronic signatures from others.',
    icon: <Pen className="w-8 h-8" />,
    category: ['all', 'edit'],
    link: '/',
  },
  {
    name: 'Watermark',
    description:
      'Stamp an image or text over your PDF in seconds. Choose the typography, transparency and position.',
    icon: <Stamp className="w-8 h-8" />,
    category: ['all', 'edit'],
    link: '/',
  },
  {
    name: 'Rotate PDF',
    description:
      'Rotate your PDFs the way you need them. You can even rotate multiple PDFs at once!',
    icon: <RefreshCw className="w-8 h-8" />,
    category: ['all', 'organize'],
    link: '/organize/rotate-pdf',
  },
  {
    name: 'Unlock PDF',
    description:
      'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
    icon: <Unlock className="w-8 h-8" />,
    category: ['all', 'security'],
    link: '/',
  },
  {
    name: 'Protect PDF',
    description:
      'Protect PDF files with a password. Encrypt PDF documents to prevent unauthorized access.',
    icon: <Lock className="w-8 h-8" />,
    category: ['all', 'security'],
    link: '/',
  },
  {
    name: 'Organize PDF',
    description:
      'Sort pages of your PDF file however you like. Delete PDF pages, rotate PDF pages or add PDF pages to your document.',
    icon: <Grid3x3 className="w-8 h-8" />,
    category: ['all', 'organize'],
    link: '/organize/organize-pdf',
  },
  {
    name: 'Page numbers',
    description:
      'Add page numbers into PDFs with ease. Choose your positions, dimensions, typography.',
    icon: <Hash className="w-8 h-8" />,
    category: ['all', 'edit'],
    link: '/',
  },
  {
    name: 'OCR PDF',
    description:
      'Easily convert scanned PDF into searchable and selectable documents.',
    icon: <Search className="w-8 h-8" />,
    category: ['all', 'optimize'],
    link: '/optimize/ocr-pdf',
  },
  {
    name: 'Crop PDF',
    description:
      'Crop margins of PDF documents or select specific areas, then apply the changes to one page or the whole document.',
    icon: <Crop className="w-8 h-8" />,
    badge: 'New',
    category: ['all', 'edit'],
    link: '/',
  },
]

const categories = [
  { id: 'all', label: 'All' },
  { id: 'organize', label: 'Organize PDF' },
  { id: 'optimize', label: 'Optimize PDF' },
  { id: 'convert', label: 'Convert PDF' },
  { id: 'edit', label: 'Edit PDF' },
  { id: 'security', label: 'PDF Security' },
]

function App() {
  const [activeCategory, setActiveCategory] = useState('all')

  const filteredTools = tools.filter((tool) =>
    tool.category.includes(activeCategory),
  )

  return (
    <div className="min-h-screen bg-linear-to-b from-red-50 to-white">
      {/* Hero Section */}
      <div className="bg-linear-to-r from-red-600 to-pink-600 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">
            Every tool you need to work with PDFs in one place
          </h1>
          <p className="text-xl mb-8 text-red-50">
            Every tool you need to use PDFs, at your fingertips. All are 100%
            FREE and easy to use! Merge, split, compress, convert, rotate,
            unlock and watermark PDFs with just a few clicks.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                  activeCategory === category.id
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool, index) => (
            <Link
              key={index}
              to={tool.link}
              className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-red-300 group"
            >
              <div className="flex items-start gap-4">
                <div className="text-red-600 group-hover:scale-110 transition-transform">
                  {tool.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-gray-800">
                      {tool.name}
                    </h3>
                    {tool.badge && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-white mb-4">PRODUCT</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Tools
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">RESOURCES</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Desktop
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Mobile
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    API
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">SOLUTIONS</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Business
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Education
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">COMPANY</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to={'/'} className="hover:text-white">
                    About us
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to={'/'} className="hover:text-white">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center text-sm">
            <p>© 2025 - Your PDF Editor</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

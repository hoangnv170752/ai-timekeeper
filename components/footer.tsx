export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Face Recognition Timekeeper</span>
            <span className="mx-2">•</span>
            <span>Version 1.0.0</span>
          </div>

          <div className="text-sm text-gray-600">
            Created by <span className="font-medium text-blue-600">Akashi</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

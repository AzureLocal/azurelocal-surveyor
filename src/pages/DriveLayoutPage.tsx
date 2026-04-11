import LayoutCompare from '../components/LayoutCompare'

export default function DriveLayoutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Drive Layout Comparison</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare how different drive counts affect reserve cost and effective usable capacity.
          Total raw capacity stays constant — only the number (and therefore size) of drives changes.
        </p>
      </div>
      <LayoutCompare />
    </div>
  )
}

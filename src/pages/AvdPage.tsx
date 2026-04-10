import AvdPlanner from '../components/AvdPlanner'

export default function AvdPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AVD Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Azure Virtual Desktop session host and FSLogix storage sizing.
          Ports the 80 formulas from the AVD Planning sheet.
        </p>
      </div>
      <AvdPlanner />
    </div>
  )
}

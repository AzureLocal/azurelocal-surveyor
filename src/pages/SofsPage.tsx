import SofsPlanner from '../components/SofsPlanner'

export default function SofsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">SOFS Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scale-Out File Server guest cluster sizing for FSLogix profile share scale-out.
          Ports the 25 formulas from the SOFS Planner sheet.
        </p>
      </div>
      <SofsPlanner />
    </div>
  )
}

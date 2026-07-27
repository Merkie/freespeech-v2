// import useMeasure from '@/lib/hooks/use-measure';
// import { createSignal } from 'solid-js';

import type { ParentComponent } from 'solid-js';

const DashboardContent: ParentComponent = (props) => {
	// const [containerRef, setContainerRef] = createSignal<
	//   HTMLDivElement | undefined
	// >();

	// const containerSize = useMeasure(containerRef);

	return (
		<div
			// ref={setContainerRef}
			class="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain bg-zinc-100"
		>
			{/* <p>
        {containerSize()?.width}px x {containerSize()?.height}px
      </p> */}
			{props.children}
		</div>
	);
};

export default DashboardContent;

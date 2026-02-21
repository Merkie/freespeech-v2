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
			class="flex flex-1 flex-col bg-zinc-100"
		>
			{/* <p>
        {containerSize()?.width}px x {containerSize()?.height}px
      </p> */}
			{props.children}
		</div>
	);
};

export default DashboardContent;

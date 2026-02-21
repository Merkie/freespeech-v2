import type { RouteSectionProps } from '@solidjs/router';
import type { Component } from 'solid-js';
import DashboardContent from './_components/DashboardContent';
import DashboardHeader from './_components/DashboardHeader';

const DashboardLayout: Component<RouteSectionProps<unknown>> = (props) => {
	return (
		<>
			<DashboardHeader />
			<DashboardContent>{props.children}</DashboardContent>
		</>
	);
};

export default DashboardLayout;

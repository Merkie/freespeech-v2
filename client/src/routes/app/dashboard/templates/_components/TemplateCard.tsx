import { createSignal, Show } from 'solid-js';
import TemplatePreview from '@/components/TemplatePreview';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Template } from '@/lib/types';

type Props = {
	template: Template;
	onDelete: () => void;
	onEdit: () => void;
	onRename?: (newName: string) => void;
};

export default function TemplateCard(props: Props) {
	const [isDeleting, setIsDeleting] = createSignal(false);
	const [showConfirm, setShowConfirm] = createSignal(false);
	const [isRenaming, setIsRenaming] = createSignal(false);
	const [editName, setEditName] = createSignal('');
	const [isSaving, setIsSaving] = createSignal(false);

	const startRenaming = () => {
		setEditName(props.template.name);
		setIsRenaming(true);
	};

	const cancelRenaming = () => {
		setIsRenaming(false);
		setEditName('');
	};

	const handleRename = async () => {
		const newName = editName().trim();
		if (!newName || newName === props.template.name || isSaving()) return;

		setIsSaving(true);
		try {
			await api.template.update(props.template.id, { name: newName });
			props.onRename?.(newName);
			setIsRenaming(false);
		} catch (err) {
			console.error('Failed to rename template:', err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleRename();
		} else if (e.key === 'Escape') {
			cancelRenaming();
		}
	};

	const handleDelete = async () => {
		if (isDeleting()) return;
		setIsDeleting(true);

		try {
			await api.template.delete(props.template.id);
			props.onDelete();
		} catch (err) {
			console.error('Failed to delete template:', err);
		} finally {
			setIsDeleting(false);
			setShowConfirm(false);
		}
	};

	const linkedPagesCount = () => props.template._count?.linkedPages || 0;

	return (
		<div class="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-zinc-200 p-4 shadow-sm">
			<div class="flex items-start gap-3">
				<TemplatePreview template={props.template} size="medium" />
				<div class="flex-1">
					<Show
						when={!isRenaming()}
						fallback={
							<div class="flex items-center gap-2">
								<input
									type="text"
									value={editName()}
									onInput={(e) => setEditName(e.currentTarget.value)}
									onKeyDown={handleKeyDown}
									autofocus
									class="h-7 flex-1 rounded border border-zinc-400 bg-white px-2 text-sm font-medium text-zinc-900 outline-none focus:border-blue-500"
								/>
								<button
									onClick={handleRename}
									disabled={isSaving() || !editName().trim() || editName().trim() === props.template.name}
									class="rounded p-1 text-green-600 transition-colors hover:bg-green-100 disabled:opacity-50"
								>
									<i class="bi bi-check-lg" />
								</button>
								<button onClick={cancelRenaming} class="rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-100">
									<i class="bi bi-x-lg" />
								</button>
							</div>
						}
					>
						<div class="flex items-center gap-1">
							<h3 class="font-medium text-zinc-900">{props.template.name}</h3>
							<button
								onClick={startRenaming}
								class="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
								title="Rename template"
							>
								<i class="bi bi-pencil text-xs" />
							</button>
						</div>
					</Show>
					<p class="text-sm text-zinc-600">
						{props.template.columns} x {props.template.rows}
					</p>
					<p class="text-xs text-zinc-500">
						{linkedPagesCount()} page{linkedPagesCount() !== 1 ? 's' : ''} linked
					</p>
				</div>
			</div>

			<Show
				when={!showConfirm()}
				fallback={
					<div class="flex gap-2">
						<button
							onClick={() => setShowConfirm(false)}
							class="flex-1 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
						>
							Cancel
						</button>
						<button
							onClick={handleDelete}
							disabled={isDeleting()}
							class={cn('flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors', {
								'border-red-500 bg-red-600 text-white hover:bg-red-500': !isDeleting(),
								'cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-400': isDeleting(),
							})}
						>
							{isDeleting() ? 'Deleting...' : 'Confirm Delete'}
						</button>
					</div>
				}
			>
				<div class="flex gap-2">
					<button
						onClick={props.onEdit}
						class="flex-1 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
					>
						<i class="bi bi-pencil mr-1" /> Edit
					</button>
					<button
						onClick={() => setShowConfirm(true)}
						class="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-red-500 hover:bg-red-50 hover:text-red-600"
					>
						<i class="bi bi-trash" />
					</button>
				</div>
			</Show>
		</div>
	);
}

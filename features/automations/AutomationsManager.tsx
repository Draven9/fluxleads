import React, { useState } from 'react';
import { AutomationsListPage } from './AutomationsListPage';
import FlowBuilderPage from './FlowBuilderPage';

export const AutomationsManager: React.FC = () => {
    const [editingFlowId, setEditingFlowId] = useState<string | 'new' | null>(null);

    if (editingFlowId !== null) {
        return (
            <FlowBuilderPage
                automationId={editingFlowId === 'new' ? undefined : editingFlowId}
                onClose={() => setEditingFlowId(null)}
            />
        );
    }

    return (
        <AutomationsListPage
            onOpenBuilder={(id) => setEditingFlowId(id || 'new')}
        />
    );
};

export default AutomationsManager;

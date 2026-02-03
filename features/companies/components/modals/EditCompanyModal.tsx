import React, { useEffect, useState } from 'react';
import { Modal, ModalForm } from '@/components/ui/Modal';
import { InputField, SubmitButton } from '@/components/ui/FormField';
import { CRMCompany } from '@/types/types';
import { companiesService } from '../../services/companiesService';
import { toast } from 'react-hot-toast';

interface EditCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    company: CRMCompany;
    onUpdate: (updatedCompany: CRMCompany) => void;
}

export const EditCompanyModal: React.FC<EditCompanyModalProps> = ({ isOpen, onClose, company, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: '',
        industry: '',
        website: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (company) {
            setFormData({
                name: company.name || '',
                industry: company.industry || '',
                website: company.website || ''
            });
        }
    }, [company, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            setIsSubmitting(true);
            const updated = await companiesService.update(company.id, {
                name: formData.name,
                industry: formData.industry,
                website: formData.website
            });
            onUpdate(updated);
            toast.success('Cliente atualizado com sucesso');
            onClose();
        } catch (error) {
            console.error('Error updating company:', error);
            toast.error('Erro ao atualizar cliente');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Editar Cliente"
            size="md"
        >
            <ModalForm onSubmit={handleSubmit}>
                <InputField
                    label="Nome da Empresa"
                    placeholder="Ex: Acme Corp"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                />

                <InputField
                    label="Segmento / Indústria"
                    placeholder="Ex: Tecnologia, Varejo..."
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />

                <InputField
                    label="Website"
                    placeholder="https://..."
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />

                <div className="flex justify-end pt-4">
                    <SubmitButton isLoading={isSubmitting} loadingText="Salvando...">
                        Salvar Alterações
                    </SubmitButton>
                </div>
            </ModalForm>
        </Modal>
    );
};

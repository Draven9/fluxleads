import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Deal } from '@/types';
import { Modal, ModalForm } from '@/components/ui/Modal';
import {
  InputField,
  SelectField,
  TextareaField,
  SubmitButton,
} from '@/components/ui/FormField';
import { DealSearchCombobox } from '@/components/ui/DealSearchCombobox';
import { activityFormSchema } from '@/lib/validations/schemas';
import type { ActivityFormData } from '@/lib/validations/schemas';

type FormActivityType = 'CALL' | 'MEETING' | 'EMAIL' | 'TASK';

interface ActivityFormModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ActivityFormData) => void;
  editingActivity: Activity | null;
  deals: Deal[];
}

const activityTypeOptions = [
  { value: 'CALL', label: 'Ligação' },
  { value: 'MEETING', label: 'Reunião' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'TASK', label: 'Tarefa' },
];

// Helper to get safe activity type for form
const getSafeActivityType = (type?: Activity['type']): FormActivityType => {
  const validTypes: FormActivityType[] = ['CALL', 'MEETING', 'EMAIL', 'TASK'];
  if (type && validTypes.includes(type as FormActivityType)) {
    return type as FormActivityType;
  }
  return 'CALL';
};

/**
 * Componente React `ActivityFormModalV2`.
 *
 * @param {ActivityFormModalV2Props} {
  isOpen,
  onClose,
  onSubmit,
  editingActivity,
  deals,
} - Parâmetro `{
  isOpen,
  onClose,
  onSubmit,
  editingActivity,
  deals,
}`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const ActivityFormModalV2: React.FC<ActivityFormModalV2Props> = ({
  isOpen,
  onClose,
  onSubmit,
  editingActivity,
  deals,
}) => {
  const defaultDate = new Date().toISOString().split('T')[0];
  const defaultTime = new Date().toTimeString().slice(0, 5);

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema) as any,
    defaultValues: {
      title: editingActivity?.title || '',
      type: getSafeActivityType(editingActivity?.type),
      date: editingActivity?.date?.split('T')[0] || defaultDate,
      time: editingActivity?.date?.split('T')[1]?.slice(0, 5) || defaultTime,
      description: editingActivity?.description || '',
      dealId: editingActivity?.dealId || '',
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = form;

  // Reset form when modal opens with different activity
  React.useEffect(() => {
    if (isOpen) {
      reset({
        title: editingActivity?.title || '',
        type: getSafeActivityType(editingActivity?.type),
        date: editingActivity?.date?.split('T')[0] || defaultDate,
        time: editingActivity?.date?.split('T')[1]?.slice(0, 5) || defaultTime,
        description: editingActivity?.description || '',
        dealId: editingActivity?.dealId || '',
      });
    }
  }, [isOpen, editingActivity, reset]);

  const handleFormSubmit = (data: ActivityFormData) => {
    onSubmit(data);
    onClose();
    reset();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
    >
      <ModalForm onSubmit={handleSubmit(handleFormSubmit)}>
        <InputField
          label="Título"
          placeholder="Ex: Ligar para Cliente"
          error={errors.title}
          registration={register('title')}
        />

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Tipo"
            options={activityTypeOptions}
            error={errors.type}
            registration={register('type')}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Negócio Relacionado
            </label>
            <Controller
              name="dealId"
              control={control}
              render={({ field }) => (
                <DealSearchCombobox
                  deals={deals}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.dealId?.message}
                />
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Data"
            type="date"
            error={errors.date}
            registration={register('date')}
          />
          <InputField
            label="Hora"
            type="time"
            error={errors.time}
            registration={register('time')}
          />
        </div>

        <TextareaField
          label="Descrição"
          placeholder="Detalhes da atividade..."
          error={errors.description}
          registration={register('description')}
        />

        <SubmitButton isLoading={isSubmitting}>
          {editingActivity ? 'Salvar Alterações' : 'Criar Atividade'}
        </SubmitButton>
      </ModalForm>
    </Modal>
  );
};

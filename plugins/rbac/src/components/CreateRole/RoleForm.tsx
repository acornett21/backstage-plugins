import React from 'react';
import { useNavigate } from 'react-router-dom';

import { SimpleStepper, SimpleStepperStep } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';

import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Paper,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { FormikErrors, FormikHelpers, useFormik } from 'formik';

import { rbacApiRef } from '../../api/RBACBackendClient';
import { MemberEntity, PermissionsData, RoleError } from '../../types';
import {
  getPermissionPoliciesData,
  getRoleData,
  validationSchema,
} from '../../utils/create-role-utils';
import {
  getKindNamespaceName,
  isSamePermissionPolicy,
  onlyInLeft,
} from '../../utils/rbac-utils';
import { useToast } from '../ToastContext';
import { AddedMembersTable } from './AddedMembersTable';
import { AddMembersForm } from './AddMembersForm';
import { PermissionPoliciesForm } from './PermissionPoliciesForm';
import { ReviewStep } from './ReviewStep';
import { RoleDetailsForm } from './RoleDetailsForm';
import { RoleFormValues } from './types';

type RoleFormProps = {
  membersData: { members: MemberEntity[]; loading: boolean; error: Error };
  titles: {
    formTitle: string;
    nameAndDescriptionTitle: string;
    usersAndGroupsTitle: string;
    permissionPoliciesTitle: string;
  };
  submitLabel?: string;
  roleName?: string;
  step?: number;
  initialValues: RoleFormValues;
};

export const RoleForm = ({
  roleName,
  step,
  titles,
  membersData,
  submitLabel,
  initialValues,
}: RoleFormProps) => {
  const { setToastMessage } = useToast();
  const [activeStep, setActiveStep] = React.useState<number>(step || 0);
  const navigate = useNavigate();
  const rbacApi = useApi(rbacApiRef);

  const navigateTo = () => {
    if (step && roleName) {
      const { kind, namespace, name } = getKindNamespaceName(roleName);

      navigate(`/rbac/roles/${kind}/${namespace}/${name}`);
    } else {
      navigate('/rbac');
    }
  };

  const updateRole = async (
    name: string,
    values: RoleFormValues,
    formikHelpers: FormikHelpers<RoleFormValues>,
  ) => {
    try {
      const newData = getRoleData(values);
      const newPermissionsData = getPermissionPoliciesData(values);

      const oldData = getRoleData(initialValues);
      const res = await rbacApi.updateRole(oldData, newData);
      if ((res as RoleError).error) {
        throw new Error(
          `${'Unable to edit the role. '}${(res as RoleError).error.message}`,
        );
      } else {
        const oldPermissionsData = getPermissionPoliciesData(initialValues);
        const newPermissions = onlyInLeft(
          newPermissionsData,
          oldPermissionsData,
          isSamePermissionPolicy,
        );
        const deletePermissions = onlyInLeft(
          oldPermissionsData,
          newPermissionsData,
          isSamePermissionPolicy,
        );

        if (newPermissions.length > 0) {
          const permissionsRes = await rbacApi.createPolicies(newPermissions);
          if ((permissionsRes as unknown as RoleError).error) {
            throw new Error(
              `Unable to create the permissions. ${
                (permissionsRes as unknown as RoleError).error.message
              }`,
            );
          }
        }

        if (deletePermissions.length > 0) {
          const permissionsRes = await rbacApi.deletePolicies(
            name,
            deletePermissions,
          );
          if ((permissionsRes as unknown as RoleError).error) {
            throw new Error(
              `Unable to delete the permissions. ${
                (permissionsRes as unknown as RoleError).error.message
              }`,
            );
          }
        }
        setToastMessage(`Role ${name} updated successfully`);
        navigateTo();
      }
    } catch (e) {
      formikHelpers.setStatus({ submitError: e });
    }
  };

  const newRole = async (
    values: RoleFormValues,
    formikHelpers: FormikHelpers<RoleFormValues>,
  ) => {
    try {
      const newData = getRoleData(values);
      const newPermissionsData = getPermissionPoliciesData(values);

      const res = await rbacApi.createRole(newData);
      if ((res as RoleError).error) {
        throw new Error(
          `${'Unable to create role. '}${(res as RoleError).error.message}`,
        );
      }
      const permissionsRes: Response | RoleError =
        await rbacApi.createPolicies(newPermissionsData);
      if ((permissionsRes as unknown as RoleError).error) {
        throw new Error(
          `Role was created successfully but unable to add permissions to the role. ${
            (permissionsRes as unknown as RoleError).error.message
          }`,
        );
      }
      setToastMessage(`Role ${newData.name} created successfully`);
      navigateTo();
    } catch (e) {
      formikHelpers.setStatus({ submitError: e });
    }
  };

  const formik = useFormik<RoleFormValues>({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: async (
      values: RoleFormValues,
      formikHelpers: FormikHelpers<RoleFormValues>,
    ) => {
      if (roleName) {
        updateRole(roleName, values, formikHelpers);
      } else {
        newRole(values, formikHelpers);
      }
    },
  });

  const validateStepField = (fieldName: string) => {
    switch (fieldName) {
      case 'name': {
        formik.validateField(fieldName);
        return formik.errors.name;
      }
      case 'selectedMembers': {
        formik.validateField(fieldName);
        return formik.errors.selectedMembers;
      }
      case 'permissionPoliciesRows': {
        formik.values.permissionPoliciesRows.forEach((_pp, index) => {
          formik.validateField(`permissionPoliciesRows[${index}].plugin`);
          formik.validateField(`permissionPoliciesRows[${index}].permission`);
        });
        return formik.errors.permissionPoliciesRows;
      }
      default:
        return undefined;
    }
  };

  const handleNext = (fieldName?: string) => {
    const error = fieldName && validateStepField(fieldName);
    if (!fieldName || !error) {
      formik.setErrors({});
      const stepNum = Math.min(activeStep + 1, 3);
      setActiveStep(stepNum);
    }
  };

  const canNextPermissionPoliciesStep = () => {
    return (
      formik.values.permissionPoliciesRows.filter(pp => !!pp.plugin).length ===
        formik.values.permissionPoliciesRows.length &&
      (!formik.errors.permissionPoliciesRows ||
        (
          formik.errors.permissionPoliciesRows as unknown as FormikErrors<
            PermissionsData[]
          >[]
        )?.filter(err => !!err)?.length === 0)
    );
  };

  const handleBack = () => setActiveStep(Math.max(activeStep - 1, 0));
  const handleCancel = () => {
    navigateTo();
  };

  const handleReset = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    setActiveStep(0);
    formik.handleReset(e);
  };

  return (
    <Card>
      <CardHeader title={titles.formTitle} />
      <Divider />
      <CardContent
        component="form"
        onSubmit={formik.handleSubmit}
        style={{ position: 'relative' }}
      >
        <SimpleStepper activeStep={activeStep}>
          <SimpleStepperStep
            title={titles.nameAndDescriptionTitle}
            actions={{
              showBack: false,
              showNext: true,
              nextText: 'Next',
              canNext: () => !!formik.values.name && !formik.errors.name,
              onNext: () => handleNext('name'),
            }}
          >
            <RoleDetailsForm
              name={formik.values.name}
              description={formik.values.description}
              handleBlur={formik.handleBlur}
              handleChange={formik.handleChange}
              nameError={formik.errors.name}
            />
          </SimpleStepperStep>
          <SimpleStepperStep
            title={titles.usersAndGroupsTitle}
            actions={{
              showNext: true,
              nextText: 'Next',
              canNext: () =>
                formik.values.selectedMembers?.length > 0 &&
                !formik.errors.selectedMembers,
              onNext: () => handleNext('selectedMembers'),
              showBack: true,
              backText: 'Back',
              onBack: handleBack,
            }}
          >
            <Box>
              <AddMembersForm
                selectedMembers={formik.values.selectedMembers}
                selectedMembersError={formik.errors.selectedMembers as string}
                setFieldValue={formik.setFieldValue}
                membersData={membersData}
              />
              <br />
              <AddedMembersTable
                selectedMembers={formik.values.selectedMembers}
                setFieldValue={formik.setFieldValue}
              />
            </Box>
          </SimpleStepperStep>
          <SimpleStepperStep
            title={titles.permissionPoliciesTitle}
            actions={{
              showNext: true,
              nextText: 'Next',
              canNext: () => canNextPermissionPoliciesStep(),
              onNext: () => handleNext('permissionPoliciesRows'),
              showBack: true,
              backText: 'Back',
              onBack: handleBack,
            }}
          >
            <PermissionPoliciesForm
              permissionPoliciesRows={formik.values.permissionPoliciesRows}
              permissionPoliciesRowsError={
                formik.errors
                  .permissionPoliciesRows as FormikErrors<PermissionsData>[]
              }
              setFieldValue={formik.setFieldValue}
              setFieldError={formik.setFieldError}
              handleBlur={formik.handleBlur}
            />
          </SimpleStepperStep>
          <SimpleStepperStep title="" end>
            <Paper square elevation={0}>
              <ReviewStep values={formik.values} isEditing={!!roleName} />
              <br />
              <Button onClick={handleBack}>Back</Button>
              <Button onClick={e => handleReset(e)}>Reset</Button>
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={
                  !!formik.errors.name ||
                  !!formik.errors.selectedMembers ||
                  !formik.dirty
                }
              >
                {submitLabel || 'Create'}
              </Button>
            </Paper>
          </SimpleStepperStep>
        </SimpleStepper>
        {formik.status?.submitError && (
          <Box style={{ paddingBottom: '16px' }}>
            <Alert severity="error">{`${formik.status.submitError}`}</Alert>
          </Box>
        )}
        <Button
          style={{ position: 'absolute', right: '0', bottom: '0' }}
          onClick={handleCancel}
          color="primary"
        >
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
};

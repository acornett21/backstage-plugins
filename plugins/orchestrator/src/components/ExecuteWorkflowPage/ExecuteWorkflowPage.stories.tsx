import React from 'react';

import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';

import { Meta, StoryObj } from '@storybook/react';

import { WorkflowDataInputSchemaResponse } from '@janus-idp/backstage-plugin-orchestrator-common';

import { fakeDataInputSchemaDifferentTypes } from '../../__fixtures__/fakeWorkflowDataInputSchemaDifferentTypes';
import { fakeDataInputSchemaResponse } from '../../__fixtures__/fakeWorkflowDataInputSchemaResponse';
import { fakeDataInputSchemaMultiStepResponse } from '../../__fixtures__/fakeWorkflowDataInputSchemaResponseMultiStep';
import { fakeDataInputSchemaMultiStepInitialStateResponse } from '../../__fixtures__/fakeWorkflowDataInputSchemaResponseMultiStepInitialState';
import { orchestratorApiRef } from '../../api';
import { MockOrchestratorClient } from '../../api/MockOrchestratorClient';
import { orchestratorRootRouteRef } from '../../routes';
import { ExecuteWorkflowPage } from './ExecuteWorkflowPage';

const meta = {
  title: 'Orchestrator/ExecuteWorkflowPage',
  component: ExecuteWorkflowPage,
  decorators: [
    (
      _,
      context?: {
        args?: {
          schemaResponse?: () => Promise<WorkflowDataInputSchemaResponse>;
        };
      },
    ) =>
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [
              orchestratorApiRef,
              new MockOrchestratorClient({
                getWorkflowDataInputSchemaResponse: context?.args
                  ?.schemaResponse
                  ? context?.args?.schemaResponse()
                  : Promise.resolve(fakeDataInputSchemaResponse),
                executeWorkflowResponse: () => {
                  // eslint-disable-next-line no-alert
                  alert('Execute workflow API called');
                  return Promise.resolve({ id: 'dummy' });
                },
              }),
            ],
          ]}
        >
          <ExecuteWorkflowPage />
        </TestApiProvider>,
        {
          mountedRoutes: {
            '/orchestrator': orchestratorRootRouteRef,
          },
        },
      ),
  ],
} satisfies Meta<typeof ExecuteWorkflowPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExecuteWorkflowPageStory: Story = {
  name: 'One step',
};

export const ExecuteWorkflowPageMultipleStepsStory: Story = {
  name: 'Multiple steps',
  args: {
    schemaResponse: () => Promise.resolve(fakeDataInputSchemaMultiStepResponse),
  },
};

export const ExecuteWorkflowPageMultipleStepsWithInitialStateStory: Story = {
  name: 'Multiple steps with initial state',
  args: {
    schemaResponse: () =>
      Promise.resolve(fakeDataInputSchemaMultiStepInitialStateResponse),
  },
};

export const DifferentInputTypesStory: Story = {
  name: 'Different input types',
  args: {
    schemaResponse: () => Promise.resolve(fakeDataInputSchemaDifferentTypes),
  },
};

export const ExecuteWorkflowPageNoSchemaStory: Story = {
  name: 'No schema',
  args: {
    schemaResponse: () => ({
      ...fakeDataInputSchemaResponse,
      schemas: [],
    }),
  },
};

export const ExecuteWorkflowPageLoadingStory: Story = {
  name: 'Loading',
  args: {
    schemaResponse: () => new Promise(() => {}),
  },
};

export const ExecuteWorkflowPageResponseErrorStory: Story = {
  name: 'Response  Error',
  args: {
    schemaResponse: () => Promise.reject(new Error('Testing error')),
  },
};

/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import React, { useState, Fragment } from 'react';
import moment from 'moment';
import { Cell } from '@nteract/presentational-components';
import {
  EuiButtonEmpty,
  EuiForm,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiOverlayMask,
  EuiSelectable,
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiHorizontalRule,
  EuiButtonIcon,
  EuiSpacer,
  EuiPopover,
  EuiLink,
  EuiContextMenu,
  EuiButton,
} from '@elastic/eui';
import { htmlIdGenerator } from '@elastic/eui/lib/services';

import {
  DashboardStart,
  DashboardContainerInput,
} from '../../../../../src/plugins/dashboard/public';
import { ViewMode } from '../../../../../src/plugins/embeddable/public';
import { CoreStart } from '../../../../../src/core/public';

import { ParaOutput } from './para_output';
import { ParaInput } from './para_input';
import { ParaVisualization } from './para_vizualizations';
import { API_PREFIX, ParaType, DATE_FORMAT } from '../../../common';

/*
 * "Paragraphs" component is used to render cells of the notebook open and "add para div" between paragraphs
 *
 * Props taken in as params are:
 * para - parsed paragraph from notebook
 * dateModified - last modified time of paragraph
 * index - index of paragraph in the notebook
 * paragraphSelector - function used to select a para on click
 * paragraphHover - function used to highlight a para on hover
 * paragraphHoverReset - function used to reset all hover-highlighted paras
 * textValueEditor - function for handling input in textarea
 * handleKeyPress - function for handling key press like "Shift-key+Enter" to run paragraph
 * addPara - function to add a new para onclick - "Add Para" Div
 * DashboardContainerByValueRenderer - Dashboard container renderer for visualization
 * deleteVizualization - function to delete a para
 * http object - for making API requests
 * showOutputOnly - boolean used to only show output without input and panels
 * deletePara - function to delete the selected para
 * runPara - function to run the selected para
 * clonePara - function to clone the selected para
 * clearPara - function to clear output of all the paras
 * savePara - function to save code of the selected para
 *
 * Cell component of nteract used as a container for paragraphs in notebook UI.
 * https://components.nteract.io/#cell
 */
type ParagraphProps = {
  para: ParaType;
  dateModified: string;
  index: number;
  paragraphSelector: (index: number) => void;
  paragraphHover: (para: ParaType) => void;
  paragraphHoverReset: () => void;
  textValueEditor: (evt: React.ChangeEvent<HTMLTextAreaElement>, index: number) => void;
  handleKeyPress: (evt: React.KeyboardEvent<Element>, para: ParaType, index: number) => void;
  addPara: (index: number, newParaContent: string, inputType: string) => void;
  DashboardContainerByValueRenderer: DashboardStart['DashboardContainerByValueRenderer'];
  deleteVizualization: (uniqueId: string) => void;
  vizualizationEditor: (vizContent: string, index: number) => void;
  http: CoreStart['http'];
  showOutputOnly: boolean;
  deletePara: (para: ParaType, index: number) => void;
  runPara: (para: ParaType, index: number) => void;
  clonePara: (para: ParaType, index: number) => void;
  savePara: (para: ParaType, index: number) => void;
};
export const Paragraphs = (props: ParagraphProps) => {
  const [isModalVisible, setIsModalVisible] = useState(false); // Boolean for showing visualization modal
  const [options, setOptions] = useState([]); // options for loading saved visualizations
  const [currentPara, setCurrentPara] = useState(0); // set current paragraph
  const [showInput, setShowInput] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const {
    para,
    index,
    paragraphSelector,
    paragraphHover,
    paragraphHoverReset,
    textValueEditor,
    handleKeyPress,
    addPara,
    DashboardContainerByValueRenderer,
    deleteVizualization,
    vizualizationEditor,
    http,
  } = props;

  const createNewVizObject = (objectId: string) => {
    const vizUniqueId = htmlIdGenerator()();

    // a dashboard container object for new visualization
    const newVizObject: DashboardContainerInput = {
      viewMode: ViewMode.VIEW,
      panels: {
        '1': {
          gridData: {
            x: 15,
            y: 0,
            w: 20,
            h: 20,
            i: '1',
          },
          type: 'visualization',
          explicitInput: {
            id: '1',
            savedObjectId: objectId,
          },
        },
      },
      isFullScreenMode: false,
      filters: [],
      useMargins: false,
      id: vizUniqueId,
      timeRange: {
        to: moment(),
        from: moment().subtract(30, 'd'),
      },
      title: 'embed_viz_' + vizUniqueId,
      query: {
        query: '',
        language: 'lucene',
      },
      refreshConfig: {
        pause: true,
        value: 15,
      },
    };
    return newVizObject;
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  // Function to add visualization to the notebook
  const onSelectViz = (newOptions) => {
    setOptions(newOptions);
    const optedViz = newOptions.filter(filterObj);
    closeModal();
    const newVizObject = createNewVizObject(optedViz[0].key);
    addPara(currentPara, JSON.stringify(newVizObject), 'VISUALIZATION');
  };

  // Shows modal with all saved visualizations for the users
  const showModal = async (index: number) => {
    setCurrentPara(index);
    http
      .get(`${API_PREFIX}/visualizations`)
      .then((res) => {
        const opt = res.savedVisualizations.map((vizObject) => ({
          label: vizObject.label,
          key: vizObject.key,
        }));
        setOptions(opt);
        setIsModalVisible(true);
      })
      .catch((err) => console.error('Fetching visualization issue', err.body.message));
  };

  const filterObj = (vObj: { checked: string }) => {
    if (vObj.checked === 'on') {
      return vObj;
    }
  };

  // Visualizations searchable form for modal
  const formSample = (
    <EuiForm>
      <Fragment>
        <EuiSelectable
          aria-label="Searchable Visualizations"
          searchable
          searchProps={{
            'data-test-subj': 'selectableSearchHere',
          }}
          options={options}
          onChange={(newOptions) => onSelectViz(newOptions)}
        >
          {(list, search) => (
            <Fragment>
              {search}
              {list}
            </Fragment>
          )}
        </EuiSelectable>
      </Fragment>
    </EuiForm>
  );

  // Modal layout if a user wants add Visualizations
  const modalLayout = (
    <EuiOverlayMask>
      <EuiModal onClose={closeModal}>
        <EuiModalHeader>
          <EuiModalHeaderTitle>Saved Visualizations</EuiModalHeaderTitle>
        </EuiModalHeader>

        <EuiModalBody>{formSample}</EuiModalBody>

        <EuiModalFooter>
          <EuiButtonEmpty onClick={closeModal}>Cancel</EuiButtonEmpty>
        </EuiModalFooter>
      </EuiModal>
    </EuiOverlayMask>
  );

  const renderParaHeader = (type: string) => {
    const isVisualization = type === 'Kibana visualization';
    const panels = [
      {
        id: 0,
        title: 'Paragraph actions',
        items: [
          {
            name: 'Duplicate',
            onClick: () => {
              setIsPopoverOpen(false);
              props.clonePara(para, index);
            },
          },
          {
            name: 'Save',
            onClick: () => {
              setIsPopoverOpen(false);
              props.savePara(para, index);
            },
          },
          {
            name: 'Insert paragraph above',
            panel: 1,
          },
          {
            name: 'Insert paragraph below',
            panel: 2,
          },
          {
            name: 'Delete',
            onClick: () => {
              setIsPopoverOpen(false);
              props.deletePara(para, index);
            },
          },
        ]
      },
      {
        id: 1,
        title: 'Insert paragraph above',
        items: [
          {
            name: 'Markdown',
            onClick: () => {
              setIsPopoverOpen(false);
              props.addPara(para.id - 1, '', 'CODE');
            },
          },
          {
            name: 'Visualization',
            onClick: () => {
              setIsPopoverOpen(false);
              showModal(para.id - 1);
            },
          },
        ],
      },
      {
        id: 2,
        title: 'Insert paragraph below',
        items: [
          {
            name: 'Markdown',
            onClick: () => {
              setIsPopoverOpen(false);
              props.addPara(para.id, '', 'CODE');
            },
          },
          {
            name: 'Visualization',
            onClick: () => {
              setIsPopoverOpen(false);
              showModal(para.id);
            },
          },
        ],
      },
    ];
    if (!isVisualization) {
      panels[0].items.unshift(
        {
          name: 'Run input',
          onClick: () => {
            setIsPopoverOpen(false);
            props.runPara(para, index);
          },
        },
      )
    }

    return (
      <>
        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiText color="subdued">
              {`[${index}] ${type}`}
              {!isVisualization &&
                <EuiButtonIcon
                  aria-label="Toggle show input"
                  iconType={showInput ? "arrowUp" : "arrowDown"}
                  onClick={() => setShowInput(!showInput)}
                />}
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiPopover
              panelPaddingSize="none"
              withTitle
              button={(<EuiButtonIcon
                aria-label="Open paragraph menu"
                iconType="boxesHorizontal"
                onClick={() => setIsPopoverOpen(true)}
              />)}
              isOpen={isPopoverOpen}
              closePopover={() => setIsPopoverOpen(false)}>
              <EuiContextMenu initialPanelId={0} panels={panels} />
            </EuiPopover>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size='s' />
      </>
    );
  }

  return (
    <div>
      {props.showOutputOnly ? (
        <>
          {!para.isVizualisation ? (
            <ParaOutput para={para} />
          ) : (
              <ParaVisualization
                DashboardContainerByValueRenderer={DashboardContainerByValueRenderer}
                vizContent={para.vizObjectInput}
                deleteVizualization={deleteVizualization}
                para={para}
                vizualizationEditor={vizualizationEditor}
              />
            )
          }
        </>
      ) : (
          <EuiPanel>
            {renderParaHeader(para.isVizualisation ? 'Kibana visualization' : 'Markdown')}
            {/* Render if para contains code */}
            {!para.isVizualisation && (
              <>
                <Cell
                  key={index}
                  _hovered={para.ishovered}
                  isSelected={para.isSelected && showInput}
                  onClick={() => paragraphSelector(index)}
                  onMouseEnter={() => paragraphHover(para)}
                  onMouseLeave={() => paragraphHoverReset()}
                >
                  {showInput && <ParaInput
                    para={para}
                    index={index}
                    textValueEditor={textValueEditor}
                    handleKeyPress={handleKeyPress}
                  />}
                  <EuiSpacer size='s' />
                  <EuiFlexGroup alignItems='center'>
                    <EuiFlexItem grow={false} />
                    <EuiFlexItem grow={false}>
                      <EuiButton size='s' onClick={() => props.runPara(para, index)}>Run</EuiButton>
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText color='subdued'>{`Last saved: ${moment(props.dateModified).format(DATE_FORMAT)}`}</EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  <EuiHorizontalRule margin='s' />
                  <ParaOutput para={para} />
                </Cell>
              </>
            )}

            {/* Render if para contains visualization */}
            {para.isVizualisation && (
              <>
                <Cell
                  key={index}
                  _hovered={para.ishovered}
                  isSelected={para.isSelected}
                  onClick={() => paragraphSelector(index)}
                  onMouseEnter={() => paragraphHover(para)}
                  onMouseLeave={() => paragraphHoverReset()}
                >
                  <ParaVisualization
                    DashboardContainerByValueRenderer={DashboardContainerByValueRenderer}
                    vizContent={para.vizObjectInput}
                    deleteVizualization={deleteVizualization}
                    para={para}
                    vizualizationEditor={vizualizationEditor}
                  />
                </Cell>
              </>
            )}
          </EuiPanel>
        )}

      {isModalVisible && modalLayout}
    </div>
  );
};

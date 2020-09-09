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

import React, { Component } from 'react';
import {
  EuiTitle,
  EuiPage,
  EuiPageBody,
  EuiPageHeader,
  EuiPageHeaderSection,
  EuiButtonGroup,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { Cells } from '@nteract/presentational-components';

import { CoreStart, ChromeBreadcrumb } from '../../../../src/core/public';
import { DashboardStart } from '../../../../src/plugins/dashboard/public';

import { Paragraphs } from './paragraph_components/paragraphs';
import { SELECTED_BACKEND, DATE_FORMAT } from '../../common';
import { API_PREFIX, ParaType } from '../../common';
import { zeppelinParagraphParser } from './helpers/zeppelin_parser';
import { defaultParagraphParser } from './helpers/default_parser';
import { NotebookType } from './main';
import moment from 'moment';
import { PanelWrapper } from './helpers/panel_wrapper';

/*
 * "Notebook" component is used to display an open notebook
 *
 * Props taken in as params are:
 * noteName - current open notebook name
 * noteId - current open notebook id
 * DashboardContainerByValueRenderer - Dashboard container renderer for visualization
 * http object: for making API requests
 */
type NotebookProps = {
  openedNotebook: NotebookType;
  setOpenedNotebook: (notebook: NotebookType) => void;
  DashboardContainerByValueRenderer: DashboardStart['DashboardContainerByValueRenderer'];
  http: CoreStart['http'];
  setBreadcrumbs: (newBreadcrumbs: ChromeBreadcrumb[]) => void;
};

type NotebookState = {
  selectedViewId: string;
  paragraphs: any; // notebook paragraphs fetched from API
  parsedPara: Array<ParaType>; // paragraphs parsed to a common format
  toggleOutput: boolean; // Hide Outputs toggle
  toggleInput: boolean; // Hide Inputs toggle
  vizPrefix: string; // prefix for visualizations in Zeppelin Adaptor
};
export class Notebook extends Component<NotebookProps, NotebookState> {
  constructor(props: Readonly<NotebookProps>) {
    super(props);
    this.state = {
      selectedViewId: 'view_both',
      paragraphs: [],
      parsedPara: [],
      toggleOutput: true,
      toggleInput: true,
      vizPrefix: '',
    };
  }

  // parse paragraphs based on backend
  parseParagraphs = () => {
    try {
      let parsedPara;
      if (SELECTED_BACKEND === 'ZEPPELIN') {
        parsedPara = zeppelinParagraphParser(this.state.paragraphs);
        this.setState({ vizPrefix: '%sh #vizobject:' });
      } else {
        parsedPara = defaultParagraphParser(this.state.paragraphs);
      }
      this.setState({ parsedPara });
    } catch (error) {
      console.error('Parsing paragraph has some issue', error);
      this.setState({ parsedPara: [] });
    }
  };

  // Assigns Loading, Running & inQueue for paragraphs in current notebook
  showParagraphRunning = (param: number | string) => {
    let parsedPara = this.state.parsedPara;
    this.state.parsedPara.map((_: ParaType, index: number) => {
      if (param === 'queue') {
        parsedPara[index].inQueue = true;
        parsedPara[index].isOutputHidden = true;
      } else if (param === 'loading') {
        parsedPara[index].isRunning = true;
        parsedPara[index].isOutputHidden = true;
      } else if (param === index) {
        parsedPara[index].isRunning = true;
        parsedPara[index].isOutputHidden = true;
      }
    });
    this.setState({ parsedPara });
  };

  // Gets the paragraph and its index which is selected by the user
  getSelectedParagraph = () => {
    let selectedPara: ParaType;
    let selectedparagraphIndex = -1;
    this.state.parsedPara.map((para: ParaType, index: number) => {
      if (para.isSelected === true) {
        selectedPara = para;
        selectedparagraphIndex = index;
      }
    });

    if (selectedparagraphIndex === -1) {
      alert('Please select a Paragraph');
    }
    return { para: selectedPara, paragraphIndex: selectedparagraphIndex };
  };

  // Sets a paragraph to selected and deselects all others
  paragraphSelector = (index: number) => {
    let parsedPara = this.state.parsedPara;
    this.state.parsedPara.map((_: ParaType, idx: number) => {
      if (index === idx) parsedPara[idx].isSelected = true;
      else parsedPara[idx].isSelected = false;
    });
    this.setState({ parsedPara });
  };

  // Resets all paragraphs state to hover:false
  paragraphHoverReset = () => {
    let parsedPara = this.state.parsedPara;
    this.state.parsedPara.map((_: ParaType, index: number) => {
      parsedPara[index].ishovered = false;
    });
    this.setState({ parsedPara });
  };

  // Sets boolean on hovering over a paragraph
  paragraphHover = (para: ParaType) => {
    this.paragraphHoverReset();
    if (!para.isSelected) para.ishovered = true;
  };

  // Function for delete a Notebook button
  deleteParagraphButton = (para: ParaType, index: number) => {
    if (index !== -1) {
      this.props.http
        .delete(`${API_PREFIX}/paragraph/` + this.props.openedNotebook.id + '/' + para.uniqueId)
        .then((res) => {
          this.setState({ paragraphs: res.paragraphs });
          this.parseParagraphs();
        })
        .catch((err) => console.error('Delete paragraph issue: ', err.body.message));
    }
  };

  // Function for delete Visualization from notebook
  deleteVizualization = (uniqueId: string) => {
    this.props.http
      .delete(`${API_PREFIX}/paragraph/` + this.props.openedNotebook.id + '/' + uniqueId)
      .then((res) => {
        this.setState({ paragraphs: res.paragraphs });
        this.parseParagraphs();
      })
      .catch((err) => console.error('Delete vizualization issue: ', err.body.message));
  };

  // Backend call to add a paragraph
  addPara = (index: number, newParaContent: string, inpType: string) => {
    let paragraphs = this.state.paragraphs;

    const addParaObj = {
      noteId: this.props.openedNotebook.id,
      paragraphIndex: index,
      paragraphInput: newParaContent,
      inputType: inpType,
    };

    this.props.http
      .post(`${API_PREFIX}/paragraph/`, {
        body: JSON.stringify(addParaObj),
      })
      .then((res) => {
        paragraphs.splice(index, 0, res);
        this.setState({ paragraphs });
        this.parseParagraphs();
      })
      .catch((err) => console.error('Add paragraph issue: ', err.body.message));
  };

  // Function to clone a paragraph
  cloneParaButton = (para: ParaType, index: number) => {
    let inputType = 'CODE';
    if (para.isVizualisation === true) {
      inputType = 'VISUALIZATION';
    }
    if (index !== -1) {
      this.addPara(index, para.inp, inputType);
    }
  };

  // Function for clearing outputs button
  clearParagraphButton = () => {
    this.showParagraphRunning('loading');
    const clearParaObj = {
      noteId: this.props.openedNotebook.id,
    };
    this.props.http
      .put(`${API_PREFIX}/paragraph/clearall/`, {
        body: JSON.stringify(clearParaObj),
      })
      .then((res) => {
        this.setState({ paragraphs: res.paragraphs });
        this.parseParagraphs();
      })
      .catch((err) => console.error('clear paragraph issue: ', err.body.message));
  };

  // Backend call to update and run contents of paragraph
  updateRunParagraph = (para: ParaType, index: number) => {
    this.showParagraphRunning(index);
    let paragraphs = this.state.paragraphs;

    const paraUpdateObject = {
      noteId: this.props.openedNotebook.id,
      paragraphId: para.uniqueId,
      paragraphInput: para.inp,
    };

    this.props.http
      .post(`${API_PREFIX}/paragraph/update/run/`, {
        body: JSON.stringify(paraUpdateObject),
      })
      .then((res) => {
        paragraphs[index] = res;
        this.setState({ paragraphs });
        this.parseParagraphs();
      })
      .catch((err) => console.error('run paragraph issue: ', err.body.message));
  };

  // Function to run all paragraphs
  runAllPara = () => {
    this.state.parsedPara.forEach((para: ParaType, index: number) => this.updateRunParagraph(para, index));
  };

  // Backend call to save contents of paragraph
  savePara = (para: ParaType, index: number) => {
    this.showParagraphRunning(index);
    let paragraphs = this.state.paragraphs;

    const paraUpdateObject = {
      noteId: this.props.openedNotebook.id,
      paragraphId: para.uniqueId,
      paragraphInput: para.inp,
    };

    this.props.http
      .put(`${API_PREFIX}/paragraph/`, {
        body: JSON.stringify(paraUpdateObject),
      })
      .then((res) => {
        paragraphs[index] = res;
        this.setState({ paragraphs });
        this.parseParagraphs();
      })
      .catch((err) => console.error('save paragraph issue: ', err.body.message));
  };

  // Function for save paragraph button
  // TODO remove
  saveParagraphButton = () => {
    const selectedParaObject = this.getSelectedParagraph();
    const savePara = selectedParaObject.para;
    const saveparagraphIndex = selectedParaObject.paragraphIndex;
    if (saveparagraphIndex !== -1) {
      this.savePara(savePara, saveparagraphIndex);
    }
  };

  // Hanldes Edits in visualization and syncs with paragraph input
  vizualizationEditor = (vizContent: string, index: number) => {
    let parsedPara = this.state.parsedPara;
    parsedPara[index].inp = this.state.vizPrefix + vizContent; // "%sh check"
    this.setState({ parsedPara });
  };

  // Handles text editor value and syncs with paragraph input
  textValueEditor = (evt: React.ChangeEvent<HTMLTextAreaElement>, index: number) => {
    if (!(evt.key === 'Enter' && evt.shiftKey)) {
      let parsedPara = this.state.parsedPara;
      parsedPara[index].inp = evt.target.value;
      this.setState({ parsedPara });
    }
  };

  // Handles run paragraph shortcut "Shift+Enter"
  handleKeyPress = (evt: React.KeyboardEvent<Element>, para: ParaType, index: number) => {
    if (evt.key === 'Enter' && evt.shiftKey) {
      this.updateRunParagraph(para, index);
    }
  };

  updateView = () => {
    let hideInput = false, hideOutput = false;
    if (this.state.selectedViewId === 'input_only')
      hideOutput = true;
    else if (this.state.selectedViewId === 'output_only')
      hideInput = true;

    let parsedPara = this.state.parsedPara;
    this.state.parsedPara.map(
      (para: ParaType, index: number) => {
        parsedPara[index].isInputHidden = hideInput;
        parsedPara[index].isOutputHidden = hideOutput;
      }
    );
    this.setState({ parsedPara });
  }

  loadParas = () => {
    this.showParagraphRunning('queue');
    this.props.http
      .get(`${API_PREFIX}/note/` + this.props.openedNotebook.id)
      .then((res) => this.setState(res, this.parseParagraphs))
      .catch((err) => console.error('Fetching notebook issue: ', err.body.message));
    this.setState({ toggleInput: true });
    this.setState({ toggleOutput: true });
  }

  // Loads a notebook based on the Notebook Id
  componentDidUpdate(prevProps: NotebookProps, _prevState: NotebookState) {
    if (this.props.openedNotebook.id !== prevProps.openedNotebook.id) {
      this.loadParas();
    }
    if (this.state.selectedViewId !== _prevState.selectedViewId) {
      this.updateView();
    }
  }

  componentDidMount() {
    this.loadParas();
    this.props.setBreadcrumbs([
      {
        text: 'Notebooks',
        href: '#',
        onClick: () => this.props.setOpenedNotebook(undefined),
      },
      {
        text: this.props.openedNotebook.path,
        href: '#',
      },
    ]);
  }

  render() {
    const viewOptions = [
      {
        id: 'view_both',
        label: 'View both',
      },
      {
        id: 'input_only',
        label: 'Input only',
      },
      {
        id: 'output_only',
        label: 'Output only',
      },
    ];

    return (
      <EuiPage>
        <EuiPageBody component="div">
          <EuiPageHeader>
            <EuiPageHeaderSection>
              <EuiTitle size="l">
                <h1>{this.props.openedNotebook.path}</h1>
              </EuiTitle>
              <EuiSpacer size='m' />
              <EuiFlexGroup gutterSize='xl'>
                <EuiFlexItem>
                  <EuiText color="subdued">Created</EuiText>
                  <EuiText>{moment(this.props.openedNotebook.dateCreated).format(DATE_FORMAT)}</EuiText>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiText color="subdued">Last updated</EuiText>
                  <EuiText>{moment(this.props.openedNotebook.dateModified).format(DATE_FORMAT)}</EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPageHeaderSection>
            <EuiPageHeaderSection>
              <EuiFlexGroup gutterSize='s'>
                <EuiFlexItem>
                  <EuiButtonGroup
                    buttonSize='m'
                    options={viewOptions}
                    idSelected={this.state.selectedViewId}
                    onChange={(id) => this.setState({ selectedViewId: id })}
                  />
                </EuiFlexItem>
                <EuiFlexItem />
                <EuiFlexItem>
                  <EuiButton>Actions</EuiButton>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiButton onClick={() => this.runAllPara()}>Run all paragraphs</EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPageHeaderSection>
          </EuiPageHeader>
          <Cells>
            <PanelWrapper shouldWrap={this.state.selectedViewId === 'output_only'}>
              {this.state.parsedPara.map((para: ParaType, index: number) => (
                <Paragraphs
                  key={'para_' + index.toString()}
                  para={para}
                  dateModified={this.state.paragraphs[index].dateModified}
                  index={index}
                  paragraphSelector={this.paragraphSelector}
                  paragraphHover={this.paragraphHover}
                  paragraphHoverReset={this.paragraphHoverReset}
                  textValueEditor={this.textValueEditor}
                  handleKeyPress={this.handleKeyPress}
                  addPara={this.addPara}
                  DashboardContainerByValueRenderer={this.props.DashboardContainerByValueRenderer}
                  deleteVizualization={this.deleteVizualization}
                  vizualizationEditor={this.vizualizationEditor}
                  http={this.props.http}
                  showOutputOnly={this.state.selectedViewId === 'output_only'}
                  deletePara={this.deleteParagraphButton}
                  runPara={this.updateRunParagraph}
                  clonePara={this.cloneParaButton}
                  savePara={this.savePara}
                />
              ))}
            </PanelWrapper>
          </Cells>
        </EuiPageBody>
      </EuiPage>
    );
  }
}

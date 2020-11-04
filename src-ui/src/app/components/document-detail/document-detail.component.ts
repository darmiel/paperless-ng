import { DatePipe, formatDate } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PaperlessCorrespondent } from 'src/app/data/paperless-correspondent';
import { PaperlessDocument } from 'src/app/data/paperless-document';
import { PaperlessDocumentType } from 'src/app/data/paperless-document-type';
import { TAG_COLOURS, PaperlessTag } from 'src/app/data/paperless-tag';
import { DocumentListViewService } from 'src/app/services/document-list-view.service';
import { OpenDocumentsService } from 'src/app/services/open-documents.service';
import { CorrespondentService } from 'src/app/services/rest/correspondent.service';
import { DocumentTypeService } from 'src/app/services/rest/document-type.service';
import { DocumentService } from 'src/app/services/rest/document.service';
import { TagService } from 'src/app/services/rest/tag.service';
import { DeleteDialogComponent } from '../common/delete-dialog/delete-dialog.component';
import { CorrespondentEditDialogComponent } from '../manage/correspondent-list/correspondent-edit-dialog/correspondent-edit-dialog.component';
import { DocumentTypeEditDialogComponent } from '../manage/document-type-list/document-type-edit-dialog/document-type-edit-dialog.component';
import { TagEditDialogComponent } from '../manage/tag-list/tag-edit-dialog/tag-edit-dialog.component';

@Component({
  selector: 'app-document-detail',
  templateUrl: './document-detail.component.html',
  styleUrls: ['./document-detail.component.css']
})
export class DocumentDetailComponent implements OnInit {

  documentId: number
  document: PaperlessDocument
  title: string
  previewUrl: string
  downloadUrl: string

  correspondents: PaperlessCorrespondent[]
  documentTypes: PaperlessDocumentType[]
  tags: PaperlessTag[]

  documentForm: FormGroup = new FormGroup({
    title: new FormControl(''),
    content: new FormControl(''),
    created: new FormControl(),
    correspondent_id: new FormControl(),
    document_type_id: new FormControl(),
    archive_serial_number: new FormControl(),
    tags_id: new FormControl([])
  })

  constructor(
    private documentsService: DocumentService, 
    private route: ActivatedRoute,
    private correspondentService: CorrespondentService,
    private documentTypeService: DocumentTypeService,
    private tagService: TagService,
    private datePipe: DatePipe,
    private router: Router,
    private modalService: NgbModal,
    private openDocumentService: OpenDocumentsService,
    private documentListViewService: DocumentListViewService) { }

  ngOnInit(): void {
    this.documentForm.valueChanges.subscribe(wow => {
      Object.assign(this.document, this.documentForm.value)
    })

    this.correspondentService.list(1,100000).subscribe(result => this.correspondents = result.results)
    this.documentTypeService.list(1,100000).subscribe(result => this.documentTypes = result.results)
    this.tagService.list(1,100000).subscribe(result => this.tags = result.results)

    this.route.paramMap.subscribe(paramMap => {
      this.documentId = +paramMap.get('id')
      this.previewUrl = this.documentsService.getPreviewUrl(this.documentId)
      this.downloadUrl = this.documentsService.getDownloadUrl(this.documentId)
      if (this.openDocumentService.getOpenDocument(this.documentId)) {
        this.updateComponent(this.openDocumentService.getOpenDocument(this.documentId))
      } else {
        this.documentsService.get(this.documentId).subscribe(doc => {
          this.openDocumentService.openDocument(doc)
          this.updateComponent(doc)
        }, error => {this.router.navigate(['404'])})
      }
    })

  }

  updateComponent(doc: PaperlessDocument) {
    this.document = doc
    this.title = doc.title
    this.documentForm.patchValue(doc)
  }

  createTag() {
    var modal = this.modalService.open(TagEditDialogComponent, {backdrop: 'static'})
    modal.componentInstance.dialogMode = 'create'
    modal.componentInstance.success.subscribe(newTag => {
      this.tagService.list().subscribe(tags => {
        this.tags = tags.results
        this.documentForm.get('tags_id').setValue(this.documentForm.get('tags_id').value.concat([newTag.id]))
      })
    })
  }

  createDocumentType() {
    var modal = this.modalService.open(DocumentTypeEditDialogComponent, {backdrop: 'static'})
    modal.componentInstance.dialogMode = 'create'
    modal.componentInstance.success.subscribe(newDocumentType => {
      this.documentTypeService.list().subscribe(documentTypes => {
        this.documentTypes = documentTypes.results
        this.documentForm.get('document_type_id').setValue(newDocumentType.id)
      })
    })
  }

  createCorrespondent() {
    var modal = this.modalService.open(CorrespondentEditDialogComponent, {backdrop: 'static'})
    modal.componentInstance.dialogMode = 'create'
    modal.componentInstance.success.subscribe(newCorrespondent => {
      this.correspondentService.list().subscribe(correspondents => {
        this.correspondents = correspondents.results
        this.documentForm.get('correspondent_id').setValue(newCorrespondent.id)
      })
    })
  }

  getTag(id: number): PaperlessTag {
    return this.tags.find(tag => tag.id == id)
  }

  getColour(id: number) {
    return TAG_COLOURS.find(c => c.id == this.getTag(id).colour)
  }

  addTag(id: number) {
    if (this.documentForm.value.tags.indexOf(id) == -1) {
      this.documentForm.value.tags.push(id)
    }
  }

  removeTag(id: number) {
    let index = this.documentForm.value.tags.indexOf(id)
    if (index > -1) {
      this.documentForm.value.tags.splice(index, 1)
    }
  }


  save() {    
    this.documentsService.update(this.document).subscribe(result => {
      this.close()
    })
  }

  saveEditNext() {
    this.documentsService.update(this.document).subscribe(result => {
      this.documentListViewService.getNext(this.document.id).subscribe(nextDocId => {
        if (nextDocId) {
          this.openDocumentService.closeDocument(this.document)
          this.router.navigate(['documents', nextDocId])
        }
      })
    })
  }

  close() {
    this.openDocumentService.closeDocument(this.document)
    if (this.documentListViewService.viewConfig) {
      this.router.navigate(['view', this.documentListViewService.viewConfig.id])
    } else {
      this.router.navigate(['documents'])
    }
  }

  delete() {
    let modal = this.modalService.open(DeleteDialogComponent, {backdrop: 'static'})
    modal.componentInstance.message = `Do you really want to delete document '${this.document.title}'?`
    modal.componentInstance.message2 = `The files for this document will be deleted permanently. This operation cannot be undone.`
    modal.componentInstance.deleteClicked.subscribe(() => {
      this.documentsService.delete(this.document).subscribe(() => {
        modal.close()  
        this.close()
      })
    })

  }

  hasNext() {
    return this.documentListViewService.hasNext(this.documentId)
  }
}
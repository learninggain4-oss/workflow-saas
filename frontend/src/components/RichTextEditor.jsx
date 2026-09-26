import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Quill ന്റെ സ്റ്റാൻഡേർഡ് തീം

// ബോൾഡ്, ഇറ്റാലിക്, ലിങ്ക് തുടങ്ങിയവയ്ക്കുള്ള മോഡ്യൂളുകൾ
// Module scope on purpose: a new object identity on every render makes
// react-quill re-initialise Quill, and the toolbar module can then try to attach
// to a container that is no longer in the DOM ("quill:toolbar ignoring
// attaching to nonexistent"). A stable reference keeps one editor instance.
//
// No 'table' entry: the installed Quill build registers no formats/table and no
// modules/table, so asking for it logged
// "quill:toolbar ignoring attaching to nonexistent format table" and rendered a
// dead, permanently hidden <select>. To get real tables, add the `quill-table`
// package, call Quill.register(...) for it, and only then list it here.
const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'link', 'image'
];

export default function RichTextEditor({ value, onChange, readOnly, placeholder, className }) {
  return (
    <div className={`rich-text-container ${className || ''}`}>
      <ReactQuill 
        theme="snow" 
        value={value || ''} 
        onChange={onChange} 
        modules={modules}
        formats={formats}
        readOnly={readOnly}
        placeholder={placeholder || "Add detailed description here..."}
      />
    </div>
  );
}
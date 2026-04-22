// client/src/pages/Students.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMasterStudents, addMasterStudent, updateMasterStudent, deleteMasterStudent, bulkAddMasterStudents, deleteAllMasterStudents, getMajors } from '../api';
import { UserPlus, Trash2, Edit2, Check, X, Upload, Download, ArrowLeft, ShieldCheck, ShieldOff, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import './Students.css';

export default function Students() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [majors, setMajors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Search and Pagination state
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Form state
    const [name, setName] = useState('');
    const [discord, setDiscord] = useState('');
    const [major, setMajor] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDiscord, setEditDiscord] = useState('');
    const [editMajor, setEditMajor] = useState('');
    const [importing, setImporting] = useState(false);
    const toast = useToast();
    const { confirm } = useConfirm();

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const [studentsData, majorsData] = await Promise.all([
                getMasterStudents(),
                getMajors()
            ]);
            setStudents(studentsData);
            setMajors(majorsData);
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch data');
            setLoading(false);
        }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        try {
            const studentExists = students.some(s => s.discord && s.discord.toLowerCase() === discord.trim().toLowerCase());
            if (studentExists) {
                toast.error('A student with this Discord account already exists.');
                return;
            }

            const newStudent = await addMasterStudent({ name, discord, major });
            // Only add if not already in list (API returns existing student if found)
            if (!students.find(s => s.id === newStudent.id)) {
                setStudents([...students, newStudent]);
            }
            setName('');
            setDiscord('');
            setMajor('');
        } catch (err) {
            toast.error('Error adding student');
        }
    };

    const handleDelete = async (id) => {
        const isConfirmed = await confirm('Are you sure you want to delete this student?');
        if (!isConfirmed) return;
        try {
            await deleteMasterStudent(id);
            setStudents(students.filter(s => s.id !== id));
        } catch (err) {
            toast.error('Error deleting student');
        }
    };

    const startEdit = (student) => {
        setEditingId(student.id);
        setEditName(student.name);
        setEditDiscord(student.discord);
        setEditMajor(student.major || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditDiscord('');
        setEditMajor('');
    };

    const handleUpdate = async (id) => {
        try {
            const updated = await updateMasterStudent(id, { name: editName, discord: editDiscord, major: editMajor });
            setStudents(students.map(s => s.id === id ? updated : s));
            cancelEdit();
        } catch (err) {
            toast.error('Error updating student');
        }
    };

    const handleToggleVerified = async (student) => {
        try {
            const updated = await updateMasterStudent(student.id, { discord_verified: !student.discord_verified });
            setStudents(students.map(s => s.id === student.id ? updated : s));
        } catch (err) {
            toast.error('Error updating verified status');
        }
    };

    const handleDeleteAll = async () => {
        const isConfirmed = await confirm(`Are you sure you want to delete all ${students.length} student(s)? This cannot be undone.`);
        if (!isConfirmed) return;

        try {
            const ids = students.map(s => s.id);
            await deleteAllMasterStudents(ids);
            setStudents([]);
            toast.success(`Successfully deleted all students.`);
        } catch (err) {
            console.error('Error deleting all students:', err);
            toast.error('Error deleting students. Please try again.');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const lines = text.split('\n');
                const seenDiscords = new Set(students.map(s => s.discord?.toLowerCase()).filter(Boolean));
                const newStudents = [];

                // Skip header if it exists
                const startIdx = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('discord')) ? 1 : 0;

                for (let i = startIdx; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // Support both comma and semicolon
                    const parts = line.includes(';') ? line.split(';') : line.split(',');
                    if (parts.length >= 1) {
                        const name = parts[0].trim();
                        const discord = parts[1] ? parts[1].trim() : '';
                        const major = parts[2] ? parts[2].trim() : '';
                        const discordLower = discord.toLowerCase();

                        if (discord && seenDiscords.has(discordLower)) {
                            continue; // Skip if already in list or batch
                        }

                        newStudents.push({ name, discord, major });
                        if (discord) seenDiscords.add(discordLower);
                    }
                }

                if (newStudents.length > 0) {
                    const created = await bulkAddMasterStudents(newStudents);
                    setStudents(prev => [...prev, ...created]);
                    toast.success(`Successfully imported ${created.length} students!`);
                } else {
                    toast.info('No new student data found (duplicates are hidden).');
                }
            } catch (err) {
                console.error('Import error:', err);
                toast.error('Failed to parse or import CSV file.');
            } finally {
                setImporting(false);
                e.target.value = ''; // Reset input
            }
        };
        reader.readAsText(file);
    };

    const handleDownloadCSV = () => {
        if (students.length === 0) {
            toast.info('No students to download.');
            return;
        }
        const header = 'Name,Discord,Major';
        const rows = students.map(s =>
            `${s.name || ''},${s.discord || ''},${s.major || ''}`
        );
        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${students.length} student(s) as CSV.`);
    };

    // Filter and paginate students
    const filteredStudents = students.filter(student => {
        const query = searchQuery.toLowerCase();
        return (
            (student.name && student.name.toLowerCase().includes(query)) ||
            (student.discord && student.discord.toLowerCase().includes(query)) ||
            (student.major && student.major.toLowerCase().includes(query))
        );
    });

    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

    // Ensure current page is valid after filtering
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (currentPage === 0 && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [filteredStudents.length, currentPage, totalPages]);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedStudents = filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="students-container">
            <div className="students-header">
                <div>
                    <button onClick={() => navigate('/')} className="btn-back-premium">
                        <ArrowLeft size={18} /> Back to Dashboard
                    </button>
                    <h1>Manage Students</h1>
                </div>
                <div className="import-wrapper">
                    <button onClick={handleDownloadCSV} className="btn btn-outline flex-center import-btn" disabled={students.length === 0}>
                        <Download size={20} className="upload-img" /> Download CSV
                    </button>
                    <input
                        type="file"
                        id="csv-upload"
                        accept=".csv"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        disabled={importing}
                    />
                    <label htmlFor="csv-upload" className="btn btn-outline flex-center import-btn" style={{ opacity: importing ? 0.5 : 1 }}>
                        <Upload size={20} className="upload-img" /> {importing ? 'Importing...' : 'Import CSV'}
                    </label>
                </div>
            </div>

            <div className="card add-student-card">
                <h3>Add New Student</h3>
                <form onSubmit={handleAddStudent} className="add-student-form">
                    <div className="input-group no-margin">
                        <label>Full Name</label>
                        <input
                            className="input-control"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. John Doe"
                            required
                        />
                    </div>
                    <div className="input-group no-margin">
                        <label>Discord Account</label>
                        <input
                            className="input-control"
                            value={discord}
                            onChange={e => setDiscord(e.target.value)}
                            placeholder="e.g. john_doe#1234"
                        />
                    </div>
                    <div className="input-group no-margin">
                        <label>Major</label>
                        <select
                            className="input-control"
                            value={major}
                            onChange={e => setMajor(e.target.value)}
                            style={{ cursor: 'pointer' }}
                        >
                            <option value="">Select major…</option>
                            {majors.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary add-student-btn">
                        <UserPlus size={20} className="user-icon" />
                        <span className="add-txt">Add</span>
                    </button>
                </form>
            </div>

            <div className="card list-student-card">
                <div className="flex-between student-list-header">
                    <h3 className="m-0">Student List ({filteredStudents.length})</h3>
                    <div className="search-container" style={{ position: 'relative', flex: '1', maxWidth: '300px', marginLeft: '2rem', marginRight: 'auto' }}>
                        <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search name, discord, or major..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1); // Reset to page 1 on search
                            }}
                            className="input-control"
                            style={{ paddingLeft: '2.5rem', margin: 0 }}
                        />
                    </div>
                    {students.length > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            className="btn btn-outline flex-center delete-all-btn"
                        >
                            <Trash2 size={16} className="trash-img" /> <span>Delete All</span>
                        </button>
                    )}
                </div>
                <div className="table-wrapper">
                    <table className="student-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Discord</th>
                                <th>Major</th>
                                <th>PLD Preference</th>
                                <th>Verified</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedStudents.map(student => (
                                <tr key={student.id}>
                                    <td data-label="Name">
                                        {editingId === student.id ? (
                                            <input
                                                className="input-control"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                            />
                                        ) : student.name}
                                    </td>
                                    <td data-label="Discord">
                                        {editingId === student.id ? (
                                            <input
                                                className="input-control"
                                                value={editDiscord}
                                                onChange={e => setEditDiscord(e.target.value)}
                                            />
                                        ) : (
                                            <code className="discord-text">
                                                {student.discord || 'N/A'}
                                            </code>
                                        )}
                                    </td>
                                    <td data-label="Major">
                                        {editingId === student.id ? (
                                            <input
                                                className="input-control"
                                                value={editMajor}
                                                onChange={e => setEditMajor(e.target.value)}
                                            />
                                        ) : (
                                            <span className="major-text">
                                                {student.major || 'N/A'}
                                            </span>
                                        )}
                                    </td>
                                    <td data-label="PLD Preference">
                                        {student.pld_day && student.pld_time ? (
                                            <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', background: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                {student.pld_day.slice(0, 3)} {student.pld_time}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not Set</span>
                                        )}
                                    </td>
                                    <td data-label="Verified">
                                        <button
                                            className={`btn-verify ${student.discord_verified ? 'verified' : 'unverified'}`}
                                            onClick={() => handleToggleVerified(student)}
                                            title={student.discord_verified ? 'Verified — click to unverify' : 'Not verified — click to verify'}
                                        >
                                            {student.discord_verified
                                                ? <><ShieldCheck size={15} /> Verified</>
                                                : <><ShieldOff size={15} /> Unverified</>}
                                        </button>
                                    </td>
                                    <td data-label="Actions" className="text-right">
                                        {editingId === student.id ? (
                                            <div className="action-buttons">
                                                <button onClick={() => handleUpdate(student.id)} className="btn-icon color-success">
                                                    <Check size={18} />
                                                </button>
                                                <button onClick={cancelEdit} className="btn-icon color-danger">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="action-buttons">
                                                <button onClick={() => startEdit(student)} className="btn-icon color-secondary">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(student.id)} className="btn-icon color-danger">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredStudents.length === 0 && (
                        <div className="empty-students">
                            {searchQuery ? "No students match your search." : "No students added yet."}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="pagination-container flex-between" style={{ marginTop: '1.5rem', padding: '0 1rem' }}>
                            <button
                                className="btn btn-outline flex-center"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                style={{ padding: '0.4rem 0.8rem' }}
                            >
                                <ChevronLeft size={16} style={{ marginRight: '0.2rem' }} /> Previous
                            </button>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                className="btn btn-outline flex-center"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                style={{ padding: '0.4rem 0.8rem' }}
                            >
                                Next <ChevronRight size={16} style={{ marginLeft: '0.2rem' }} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

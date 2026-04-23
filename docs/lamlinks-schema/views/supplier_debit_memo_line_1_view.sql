-- dbo.supplier_debit_memo_line_1_view



/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */

/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */


/* view supplier_debit_memo_line_1_view: add view */
CREATE VIEW [dbo].[supplier_debit_memo_line_1_view]
AS
SELECT     dbo.supplier_debit_memo_1_view.s_code_k39, dbo.supplier_debit_memo_1_view.e_name_k12, dbo.supplier_debit_memo_1_view.dmcnum_kcr, 
                      dbo.supplier_debit_memo_1_view.dmcsta_kcr, dbo.supplier_debit_memo_1_view.idnk39_k39, dbo.supplier_debit_memo_1_view.idnkcr_kcr, 
                      dbo.kcs_tab.dml_no_kcs, dbo.kcs_tab.srmano_kcs, dbo.kcs_tab.dmldes_kcs, dbo.kcs_tab.matdsp_kcs, dbo.kcs_tab.dmlqty_kcs, dbo.kcs_tab.dml_ui_kcs, 
                      dbo.kcs_tab.dmlxml_kcs, dbo.qa_inspection_line_1_view.idnkcq_kcq, dbo.kcs_tab.dml_up_kcs, dbo.kcs_tab.idnkcs_kcs, dbo.kcs_tab.idnkct_kcs, 
                      dbo.carrier_account_1_view.e_name_car, dbo.carrier_account_1_view.catdes_via, dbo.carrier_account_1_view.catdes_typ, dbo.carrier_account_1_view.cactno_kcw, 
                      dbo.carrier_account_1_view.idnkcw_kcw, dbo.supplier_debit_memo_1_view.idnk12_k12, dbo.kct_tab.sranum_kct, dbo.kct_tab.idnkct_kct
FROM         dbo.supplier_debit_memo_1_view INNER JOIN
                      dbo.kcs_tab ON dbo.supplier_debit_memo_1_view.idnkcr_kcr = dbo.kcs_tab.idnkcr_kcs LEFT OUTER JOIN
                      dbo.qa_inspection_line_1_view ON dbo.kcs_tab.idndbs_kcs = dbo.qa_inspection_line_1_view.idnkcq_kcq AND dbo.kcs_tab.dbstbl_kcs = 'kcq' LEFT OUTER JOIN
                      dbo.supplier_po_part_1_view ON dbo.kcs_tab.idndbs_kcs = dbo.supplier_po_part_1_view.idnk90_k90 AND dbo.kcs_tab.dbstbl_kcs = 'k90' LEFT OUTER JOIN
                      dbo.carrier_account_1_view ON dbo.kcs_tab.idnkcw_kcs = dbo.carrier_account_1_view.idnkcw_kcw LEFT OUTER JOIN
                      dbo.kct_tab ON dbo.kcs_tab.idnkct_kcs = dbo.kct_tab.idnkct_kct



















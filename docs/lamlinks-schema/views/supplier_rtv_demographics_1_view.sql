-- dbo.supplier_rtv_demographics_1_view



/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */

/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */


/* view supplier_rtv_demographics_1_view: add view */
CREATE VIEW [dbo].[supplier_rtv_demographics_1_view]
AS
SELECT     dbo.supplier_debit_memo_line_1_view.s_code_k39, dbo.supplier_debit_memo_line_1_view.e_name_k12, dbo.supplier_debit_memo_line_1_view.dmcnum_kcr, 
                      dbo.supplier_debit_memo_line_1_view.dmcsta_kcr, dbo.supplier_debit_memo_line_1_view.idnk39_k39, dbo.supplier_debit_memo_line_1_view.idnkcr_kcr, 
                      dbo.supplier_debit_memo_line_1_view.dml_no_kcs, dbo.supplier_debit_memo_line_1_view.srmano_kcs, dbo.supplier_debit_memo_line_1_view.dmldes_kcs, 
                      dbo.supplier_debit_memo_line_1_view.dmlqty_kcs, dbo.supplier_debit_memo_line_1_view.dml_ui_kcs, dbo.supplier_debit_memo_line_1_view.dmlxml_kcs, 
                      dbo.supplier_debit_memo_line_1_view.idnkcq_kcq, dbo.supplier_debit_memo_line_1_view.dml_up_kcs, dbo.supplier_debit_memo_line_1_view.idnkcs_kcs, 
                      dbo.supplier_debit_memo_line_1_view.idnkct_kcs, dbo.supplier_rma_demographics_1_view.sradte_kct, dbo.supplier_rma_demographics_1_view.sranum_kct, 
                      dbo.supplier_rma_demographics_1_view.sraino_kct, dbo.supplier_rma_demographics_1_view.idnkct_kct, dbo.supplier_rma_demographics_1_view.idnka7_ka7, 
                      dbo.supplier_rma_demographics_1_view.gduset_ka7, dbo.supplier_rma_demographics_1_view.d_code_ka7, dbo.supplier_rma_demographics_1_view.d_name_ka7, 
                      dbo.supplier_rma_demographics_1_view.d_adr1_ka7, dbo.supplier_rma_demographics_1_view.d_adr2_ka7, dbo.supplier_rma_demographics_1_view.d_adr3_ka7, 
                      dbo.supplier_rma_demographics_1_view.d_city_ka7, dbo.supplier_rma_demographics_1_view.d_stte_ka7, dbo.supplier_rma_demographics_1_view.d_zipc_ka7, 
                      dbo.supplier_rma_demographics_1_view.d_cntr_ka7, dbo.supplier_rma_demographics_1_view.d_attn_ka7, dbo.supplier_debit_memo_line_1_view.matdsp_kcs, 
                      dbo.supplier_debit_memo_line_1_view.idnkcw_kcw, dbo.supplier_debit_memo_line_1_view.idnk12_k12
FROM         dbo.supplier_debit_memo_line_1_view LEFT OUTER JOIN
                      dbo.supplier_rma_demographics_1_view ON dbo.supplier_debit_memo_line_1_view.idnkct_kcs = dbo.supplier_rma_demographics_1_view.idngdu_ka6 AND 
                      dbo.supplier_rma_demographics_1_view.gdutbl_ka6 = 'kct'



















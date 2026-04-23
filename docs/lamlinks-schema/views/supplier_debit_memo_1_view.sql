-- dbo.supplier_debit_memo_1_view



/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */

/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */


/* view supplier_debit_memo_1_view: add view */
CREATE VIEW [dbo].[supplier_debit_memo_1_view]
AS
SELECT     dbo.supplier_1_view.s_code_k39, dbo.supplier_1_view.e_name_k12, dbo.kcr_tab.dmc_no_kcr, dbo.kcr_tab.dmcnum_kcr, dbo.kcr_tab.dmcsta_kcr, 
                      dbo.supplier_1_view.idnk39_k39, dbo.kcr_tab.idnkcr_kcr, dbo.supplier_1_view.idnk12_k12
FROM         dbo.supplier_1_view INNER JOIN
                      dbo.kcr_tab ON dbo.supplier_1_view.idnk39_k39 = dbo.kcr_tab.idnk39_kcr



















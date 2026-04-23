-- dbo.supplier_rma_1_view



/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */

/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */


/* view supplier_rma_1_view: add view */
CREATE VIEW [dbo].[supplier_rma_1_view]
AS
SELECT     dbo.supplier_1_view.s_code_k39, dbo.supplier_1_view.e_name_k12, dbo.supplier_1_view.idnk39_k39, dbo.kct_tab.sradte_kct, dbo.kct_tab.sranum_kct, 
                      dbo.kct_tab.sraino_kct, dbo.kct_tab.idnkct_kct
FROM         dbo.kct_tab INNER JOIN
                      dbo.supplier_1_view ON dbo.kct_tab.idnk39_kct = dbo.supplier_1_view.idnk39_k39



















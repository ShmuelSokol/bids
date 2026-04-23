-- dbo.gl_transaction_1_view



/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */

/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */


/* view gl_transaction_1_view: add view */
CREATE VIEW [dbo].[gl_transaction_1_view]
AS
SELECT     dbo.k96_tab.gl_nam_k96 AS gl_nam_dbt, dbo.k96_tab.gl_num_k96 AS gl_num_dbt, dbo.k96_tab.gl_cat_k96 AS gl_cat_dbt, dbo.k97_tab.gl_grp_k97 AS gl_grp_dbt, 
                      dbo.k97_tab.gl_utp_k97 AS gl_utp_dbt, dbo.k97_tab.gl_sgt_k97 AS gl_sgt_dbt, dbo.k97_tab.gl_blc_k97 AS gl_blc_dbt, k96_tab_1.gl_nam_k96 AS gl_nam_crd, 
                      k96_tab_1.gl_num_k96 AS gl_num_crd, k96_tab_1.gl_cat_k96 AS gl_cat_crd, k97_tab_1.gl_utp_k97 AS gl_utp_crd, k97_tab_1.gl_sgt_k97 AS gl_sgt_crd, 
                      k97_tab_1.gl_blc_k97 AS gl_blc_crd, dbo.k94_tab.idnk94_k94, dbo.k96_tab.idnk96_k96 AS idnk96_dbt, k96_tab_1.idnk96_k96 AS idnk96_crd, 
                      dbo.k97_tab.idnk97_k97 AS idnk97_dbt, k97_tab_1.idnk97_k97 AS idnk97_crd, dbo.k94_tab.ft1tbl_k94, dbo.k94_tab.idnft1_k94, dbo.k94_tab.ft2tbl_k94, 
                      dbo.k94_tab.idnft2_k94, dbo.k94_tab.prmtbl_k94, dbo.k94_tab.idnprm_k94, dbo.k94_tab.gl_val_k94, dbo.k94_tab.gl_des_k94, dbo.k94_tab.postfl_k94, 
                      dbo.k94_tab.posdte_k94
FROM         dbo.k96_tab INNER JOIN
                      dbo.k94_tab ON dbo.k96_tab.idnk96_k96 = dbo.k94_tab.dbtk96_k94 INNER JOIN
                      dbo.k96_tab AS k96_tab_1 ON dbo.k94_tab.crdk96_k94 = k96_tab_1.idnk96_k96 INNER JOIN
                      dbo.k97_tab AS k97_tab_1 ON k96_tab_1.idnk97_k96 = k97_tab_1.idnk97_k97 INNER JOIN
                      dbo.k97_tab ON dbo.k96_tab.idnk97_k96 = dbo.k97_tab.idnk97_k97



















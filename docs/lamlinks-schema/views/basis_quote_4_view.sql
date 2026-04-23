-- dbo.basis_quote_4_view



/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */

/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */


/* view basis_quote_4_view: add view */
CREATE VIEW [dbo].[basis_quote_4_view]
AS
SELECT DISTINCT 
                         dbo.basis_quote_1_view.s_code_k39, dbo.basis_quote_1_view.e_name_k12, dbo.basis_quote_1_view.rfq_no_k42, dbo.basis_quote_1_view.untcst_k57, dbo.basis_quote_1_view.p_um_k56, 
                         dbo.basis_quote_1_view.su_lbs_k56, dbo.basis_quote_1_view.idnk08_k08, dbo.k58_tab.xc_typ_k58, dbo.k58_tab.xc_cst_k58, dbo.k58_tab.xc_des_k58, dbo.basis_quote_1_view.idnk55_k55, 
                         dbo.basis_quote_1_view.idnk57_k57, dbo.solicitation_identity_1_view.idnkc4_kc4
FROM            dbo.basis_quote_1_view INNER JOIN
                         dbo.solicitation_identity_1_view ON dbo.basis_quote_1_view.idnk11_k11 = dbo.solicitation_identity_1_view.idnk11_k11 LEFT OUTER JOIN
                         dbo.k58_tab ON dbo.basis_quote_1_view.idnk57_k57 = dbo.k58_tab.idnk57_k58
















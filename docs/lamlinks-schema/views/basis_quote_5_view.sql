-- dbo.basis_quote_5_view



/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */

/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */


/* view basis_quote_5_view: add view */
CREATE VIEW [dbo].[basis_quote_5_view]
AS
SELECT DISTINCT dbo.basis_quote_1_view.s_code_k39, dbo.basis_quote_1_view.e_name_k12, dbo.basis_quote_1_view.rfq_no_k42, dbo.basis_quote_1_view.untcst_k57, dbo.basis_quote_1_view.p_um_k56,
                             (SELECT        ISNULL(SUM(xc_cst_k58), 0) AS Expr1
                               FROM            dbo.k58_tab
                               WHERE        (dbo.basis_quote_1_view.idnk57_k57 = idnk57_k58) AND (xc_typ_k58 = 'unit')) AS xc_cst_unt,
                             (SELECT        ISNULL(SUM(xc_cst_k58), 0) AS Expr1
                               FROM            dbo.k58_tab AS k58_tab_2
                               WHERE        (dbo.basis_quote_1_view.idnk57_k57 = idnk57_k58) AND (xc_typ_k58 = 'lot')) AS xc_cst_lot, dbo.basis_quote_1_view.su_lbs_k56, dbo.basis_quote_1_view.idnk08_k08, 
                         dbo.basis_quote_1_view.idnk55_k55, dbo.basis_quote_1_view.idnk57_k57, dbo.solicitation_identity_1_view.idnkc4_kc4
FROM            dbo.basis_quote_1_view INNER JOIN
                         dbo.solicitation_identity_1_view ON dbo.basis_quote_1_view.idnk11_k11 = dbo.solicitation_identity_1_view.idnk11_k11
















-- dbo.basis_quote_3_view



/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */

/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */


/* view basis_quote_3_view: add view */
CREATE VIEW [dbo].[basis_quote_3_view]
AS
SELECT     dbo.basis_quote_1_view.upname_k34, dbo.basis_quote_1_view.e_name_k12, dbo.basis_quote_1_view.s_code_k39, dbo.basis_quote_1_view.untcst_k57, 
                      dbo.basis_quote_1_view.p_um_k56, dbo.k11_tab.pr_num_k11, dbo.k11_tab.idnk08_k11, dbo.k11_tab.idnk11_k11, dbo.basis_quote_1_view.idnk43_k43, 
                      dbo.basis_quote_1_view.idnk34_k34, dbo.basis_quote_1_view.minqty_k57
FROM         dbo.basis_quote_1_view INNER JOIN
                      dbo.solicitation_line_1_view ON dbo.basis_quote_1_view.idnk11_k11 = solicitation_line_1_view.idnk11_frm INNER JOIN
                      dbo.k11_tab ON dbo.solicitation_line_1_view.idnk11_k11 = dbo.k11_tab.idnk11_k11


















